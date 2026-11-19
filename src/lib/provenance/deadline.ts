/** DFARS 252.225-7052's upstream stages (mining, refining, separating) apply from this date (UTC). */
export const DFARS_DATE_UTC = Date.UTC(2027, 0, 1);

/** Whole days left until the deadline, rounded up; 0 on and after the date. */
export function daysUntilDeadline(now = Date.now()) {
  return Math.max(0, Math.ceil((DFARS_DATE_UTC - now) / 86_400_000));
}
