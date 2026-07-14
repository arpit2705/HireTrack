import { describe, expect, it } from "vitest";
import {
  MAX_RESUME_BYTES,
  validateResume,
} from "@/lib/uploads/resume";

// Crafted file contents - validation must decide from magic bytes alone.
const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(256)]);
const docx = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]), // PK zip local header
  Buffer.alloc(64),
  Buffer.from("word/document.xml"),
  Buffer.alloc(64),
]);
const legacyDoc = Buffer.concat([
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), // OLE2
  Buffer.alloc(256),
]);
const exe = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(256)]);
const html = Buffer.from("<!DOCTYPE html><html><body>hi</body></html>");
const plainZip = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.alloc(256), // no word/ entry -> a zip, but not a docx
]);

describe("validateResume (magic bytes, declared type ignored)", () => {
  it("accepts a real PDF even when the browser lies about Content-Type", () => {
    const result = validateResume(pdf, "image/png");
    expect(result).toEqual({
      ok: true,
      contentType: "application/pdf",
      extension: "pdf",
    });
  });

  it("accepts DOCX and legacy DOC", () => {
    expect(validateResume(docx, "whatever")).toMatchObject({
      ok: true,
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extension: "docx",
    });
    expect(validateResume(legacyDoc, "whatever")).toMatchObject({
      ok: true,
      contentType: "application/msword",
      extension: "doc",
    });
  });

  it("rejects an EXE renamed resume.pdf with declared application/pdf", () => {
    expect(validateResume(exe, "application/pdf")).toEqual({
      ok: false,
      reason: "unsupported_type",
    });
  });

  it("rejects HTML masquerading as a PDF (stored-XSS vector)", () => {
    expect(validateResume(html, "application/pdf")).toEqual({
      ok: false,
      reason: "unsupported_type",
    });
  });

  it("rejects a zip that is not a DOCX", () => {
    expect(validateResume(plainZip, "application/msword")).toEqual({
      ok: false,
      reason: "unsupported_type",
    });
  });

  it("rejects empty and near-empty files", () => {
    expect(validateResume(Buffer.alloc(0), "application/pdf").ok).toBe(false);
    expect(validateResume(Buffer.from("%P"), "application/pdf").ok).toBe(
      false,
    );
  });

  it("hard-rejects files over the size cap regardless of type", () => {
    const huge = Buffer.concat([
      Buffer.from("%PDF-1.7\n"),
      Buffer.alloc(MAX_RESUME_BYTES),
    ]);
    expect(validateResume(huge, "application/pdf")).toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("caps at 5 MB", () => {
    expect(MAX_RESUME_BYTES).toBe(5 * 1024 * 1024);
  });
});
