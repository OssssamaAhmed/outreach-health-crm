import { format } from "date-fns";

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | Date | null | undefined;
};

function escapeCell(input: string | number | Date | null | undefined): string {
  if (input === null || input === undefined) return "";
  const raw = input instanceof Date ? format(input, "yyyy-MM-dd") : String(input);
  if (/[",\r\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const head = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => escapeCell(c.value(r))).join(",")).join("\r\n");
  return body ? `${head}\r\n${body}\r\n` : `${head}\r\n`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function csvFilename(prefix: string, date: Date = new Date()): string {
  return `${prefix}_${format(date, "yyyy-MM-dd")}.csv`;
}
