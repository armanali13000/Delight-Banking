const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatRegistrationDate(value) {
  if (value === undefined || value === null || value === "") return "Registration date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Registration date unavailable";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata"
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return parts.day + " " + MONTHS[Number(parts.month) - 1] + " " + parts.year + ", " + parts.hour + ":" + parts.minute + " " + parts.dayPeriod.toUpperCase() + " IST";
}