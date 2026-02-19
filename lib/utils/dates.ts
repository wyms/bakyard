import { format, isToday as fnsIsToday, isTomorrow as fnsIsTomorrow, differenceInMinutes, differenceInHours, differenceInDays, parseISO } from 'date-fns';

/**
 * Parse a date value into a Date object.
 */
function toDate(value: string | Date): Date {
  if (typeof value === 'string') {
    return parseISO(value);
  }
  return value;
}

/**
 * Format a session time range for display.
 * e.g. "Tue, Feb 18 \u2022 2:00 - 3:30 PM"
 */
export function formatSessionTime(
  startsAt: string | Date,
  endsAt: string | Date
): string {
  const start = toDate(startsAt);
  const end = toDate(endsAt);

  const dayPart = format(start, 'EEE, MMM d');
  const startTime = format(start, 'h:mm');
  const endTime = format(end, 'h:mm a');

  return `${dayPart} \u2022 ${startTime} - ${endTime}`;
}

/**
 * Format a date as a relative time string.
 * e.g. "in 2 hours", "tomorrow", "in 3 days"
 */
export function formatRelativeTime(date: string | Date): string {
  const target = toDate(date);
  const now = new Date();

  if (target < now) {
    return 'past';
  }

  const minutesDiff = differenceInMinutes(target, now);
  const hoursDiff = differenceInHours(target, now);
  const daysDiff = differenceInDays(target, now);

  if (minutesDiff < 60) {
    return minutesDiff <= 1 ? 'in 1 minute' : `in ${minutesDiff} minutes`;
  }

  if (hoursDiff < 24) {
    return hoursDiff === 1 ? 'in 1 hour' : `in ${hoursDiff} hours`;
  }

  if (fnsIsTomorrow(target)) {
    return 'tomorrow';
  }

  if (daysDiff < 7) {
    return `in ${daysDiff} days`;
  }

  return format(target, 'MMM d');
}

/**
 * Check if a date is today.
 */
export function isToday(date: string | Date): boolean {
  return fnsIsToday(toDate(date));
}

/**
 * Check if a date is tomorrow.
 */
export function isTomorrow(date: string | Date): boolean {
  return fnsIsTomorrow(toDate(date));
}
