// Resume upload validation. The ONLY authority on file type is the file's
// magic bytes - the browser-declared Content-Type is accepted as a parameter
// solely so callers can log what the client claimed; it never influences the
// verdict (a spoofed header is the expected attack, plan.md section 10).

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

// Extensions are assigned by US at upload time (from the sniffed type), so
// mapping a stored locator's extension back to a content type is reliable.
const CONTENT_TYPES = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

export function contentTypeForLocator(locator: string): string | null {
  const extension = locator.split("?")[0]?.split(".").pop()?.toLowerCase();
  return extension && extension in CONTENT_TYPES
    ? CONTENT_TYPES[extension as keyof typeof CONTENT_TYPES]
    : null;
}

export type ResumeValidation =
  | { ok: true; contentType: string; extension: "pdf" | "doc" | "docx" }
  | { ok: false; reason: "unsupported_type" | "too_large" };

function startsWith(buffer: Buffer, bytes: number[] | string): boolean {
  const prefix =
    typeof bytes === "string" ? Buffer.from(bytes, "ascii") : Buffer.from(bytes);
  return (
    buffer.length >= prefix.length &&
    buffer.subarray(0, prefix.length).equals(prefix)
  );
}

export function validateResume(
  buffer: Buffer,
  declaredContentType?: string,
): ResumeValidation {
  // Deliberately unused: magic bytes are the only authority. The parameter
  // stays so call sites document what the client claimed.
  void declaredContentType;

  if (buffer.byteLength > MAX_RESUME_BYTES) {
    return { ok: false, reason: "too_large" };
  }

  // %PDF-
  if (startsWith(buffer, "%PDF-")) {
    return { ok: true, contentType: "application/pdf", extension: "pdf" };
  }

  // OLE2 compound file (legacy .doc)
  if (startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return { ok: true, contentType: "application/msword", extension: "doc" };
  }

  // Zip container: only a DOCX qualifies, which requires a word/ entry -
  // a plain zip or any other Office format is rejected.
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) {
    if (buffer.includes(Buffer.from("word/", "ascii"))) {
      return {
        ok: true,
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        extension: "docx",
      };
    }
    return { ok: false, reason: "unsupported_type" };
  }

  return { ok: false, reason: "unsupported_type" };
}
