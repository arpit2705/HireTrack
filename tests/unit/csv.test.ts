import { describe, expect, it } from "vitest";
import { escapeCsvField, toCsvRow } from "@/lib/csv";

describe("escapeCsvField", () => {
  it("passes plain values through", () => {
    expect(escapeCsvField("Ada Lovelace")).toBe("Ada Lovelace");
  });

  it("quotes commas, quotes, and newlines", () => {
    expect(escapeCsvField("Lovelace, Ada")).toBe('"Lovelace, Ada"');
    expect(escapeCsvField('the "Countess"')).toBe('"the ""Countess"""');
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralizes spreadsheet formula injection", () => {
    // =, +, -, @ leading a cell executes in Excel/Sheets exports.
    expect(escapeCsvField("=HYPERLINK('evil')")).toBe("'=HYPERLINK('evil')");
    expect(escapeCsvField("+1234")).toBe("'+1234");
    expect(escapeCsvField("@import")).toBe("'@import");
    expect(escapeCsvField("-2+3")).toBe("'-2+3");
  });

  it("renders null/undefined as empty", () => {
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
  });
});

describe("toCsvRow", () => {
  it("joins escaped fields with CRLF terminator", () => {
    expect(toCsvRow(["a", "b,c", null])).toBe('a,"b,c",\r\n');
  });
});
