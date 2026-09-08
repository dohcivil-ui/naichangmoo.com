// The timezone is pinned because the server may run in UTC: without it, anything recorded
// just after Bangkok midnight would be displayed to the user as the previous day.
const dateOnly = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" });
const dateAndTime = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok"
});

/**
 * Year and month as they read in Bangkok, as numbers rather than a formatted string.
 *
 * `getFullYear()` and `getMonth()` answer in the timezone of the machine that runs the code, which
 * on a UTC server is not the timezone this business lives in. A claim that expires at the end of a
 * month would keep speaking for the first seven hours of the next one — the same class of bug the
 * pinned formatters above exist to stop, one step earlier, before anything is formatted.
 */
const yearMonthParts = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  timeZone: "Asia/Bangkok"
});

export function bangkokYearMonth(value: Date): { year: number; month: number } {
  const parts = yearMonthParts.formatToParts(value);
  const read = (type: "year" | "month") => Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month") };
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatThaiDate(value: Date | string | null | undefined): string | null {
  const date = toDate(value);
  return date ? dateOnly.format(date) : null;
}

export function formatThaiDateTime(value: Date | string | null | undefined): string | null {
  const date = toDate(value);
  return date ? dateAndTime.format(date) : null;
}
