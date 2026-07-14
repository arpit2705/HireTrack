import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";

// Resume file storage behind one driver interface. Locators returned by
// put() are SERVER-SIDE SECRETS: they are stored in the DB and must never
// appear in an API response, page, or log - the only client path to file
// bytes is GET /api/candidates/:id/resume, which re-checks org + role on
// every request. (Vercel Blob URLs are long-lived and public-but-unguessable;
// keeping them server-side is what makes file access org-scoped.)
//
// Driver selection: Vercel Blob when BLOB_READ_WRITE_TOKEN is set,
// local .uploads/ directory otherwise (dev fallback, gitignored).

export interface StoredFile {
  data: Buffer;
  contentType: string;
}

interface StorageDriver {
  put(key: string, data: Buffer, contentType: string): Promise<string>; // -> locator
  get(locator: string, contentType: string): Promise<StoredFile | null>;
  delete(locator: string): Promise<void>;
}

const LOCAL_DIR = path.join(process.cwd(), ".uploads");
const LOCAL_PREFIX = "local:";

const localDriver: StorageDriver = {
  async put(key, data) {
    const filePath = path.join(LOCAL_DIR, key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
    return `${LOCAL_PREFIX}${key}`;
  },
  async get(locator, contentType) {
    try {
      const data = await readFile(
        path.join(LOCAL_DIR, locator.slice(LOCAL_PREFIX.length)),
      );
      return { data, contentType };
    } catch {
      return null;
    }
  },
  async delete(locator) {
    await rm(path.join(LOCAL_DIR, locator.slice(LOCAL_PREFIX.length)), {
      force: true,
    });
  },
};

const blobDriver: StorageDriver = {
  async put(key, data, contentType) {
    const blob = await put(key, data, {
      access: "public",
      contentType,
      addRandomSuffix: true,
    });
    return blob.url;
  },
  async get(locator, contentType) {
    const response = await fetch(locator);
    if (!response.ok) return null;
    return {
      data: Buffer.from(await response.arrayBuffer()),
      contentType,
    };
  },
  async delete(locator) {
    await del(locator);
  },
};

function driver(): StorageDriver {
  return process.env.BLOB_READ_WRITE_TOKEN ? blobDriver : localDriver;
}

export function storeFile(
  key: string,
  data: Buffer,
  contentType: string,
): Promise<string> {
  return driver().put(key, data, contentType);
}

export function readStoredFile(
  locator: string,
  contentType: string,
): Promise<StoredFile | null> {
  const which = locator.startsWith(LOCAL_PREFIX) ? localDriver : blobDriver;
  return which.get(locator, contentType);
}

export function deleteStoredFile(locator: string): Promise<void> {
  const which = locator.startsWith(LOCAL_PREFIX) ? localDriver : blobDriver;
  return which.delete(locator);
}
