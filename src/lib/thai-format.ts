// The timezone is pinned because the server may run in UTC: without it, anything recorded
// just after Bangkok midnight would be displayed to the user as the previous day.
const dateOnly = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" });
const dateAndTime = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok"
});

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
