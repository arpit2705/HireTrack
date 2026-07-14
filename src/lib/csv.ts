// CSV helpers for streamed exports. Escaping covers RFC 4180 quoting plus
// spreadsheet formula-injection: a leading = + - @ executes when the export
// is opened in Excel/Sheets, so those cells get a neutralizing apostrophe.

export function escapeCsvField(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  let field = String(value);
  if (/^[=+\-@]/.test(field)) field = `'${field}`;
  if (/[",\r\n]/.test(field)) field = `"${field.replaceAll('"', '""')}"`;
  return field;
}

export function toCsvRow(fields: Array<string | null | undefined>): string {
  return `${fields.map(escapeCsvField).join(",")}\r\n`;
}
