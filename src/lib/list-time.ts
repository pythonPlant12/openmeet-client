const DAY_MS = 24 * 60 * 60 * 1000;

/** The time shown at the end of a list row: the clock today, then "Yesterday", a weekday within the week, and a
 *  short date before that. Chats and calls share it, so both lists read the same. */
export function formatListTime(timestamp: number, now: Date) {
  if (Number.isNaN(timestamp)) return '';
  const date = new Date(timestamp);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (timestamp >= startOfToday) {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  }
  if (timestamp >= startOfToday - DAY_MS) return 'Yesterday';
  if (timestamp >= startOfToday - 6 * DAY_MS)
    return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(date);
  return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' }).format(date);
}
