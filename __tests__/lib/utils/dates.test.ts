import { formatSessionTime, formatRelativeTime, isToday, isTomorrow } from '@/lib/utils/dates';
import { format } from 'date-fns';

// Fixed reference point: 2026-02-17T12:00:00.000Z (a Tuesday)
const NOW = new Date('2026-02-17T12:00:00.000Z');

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterAll(() => {
  jest.useRealTimers();
});

describe('date utilities', () => {
  // ---------------------------------------------------------------
  // formatSessionTime
  // ---------------------------------------------------------------
  describe('formatSessionTime', () => {
    it('formats a session time range from ISO strings', () => {
      const startISO = '2026-02-18T14:00:00.000Z';
      const endISO = '2026-02-18T15:30:00.000Z';
      const result = formatSessionTime(startISO, endISO);

      // Build the expected output using the same formatting logic,
      // which respects the local timezone just like the source code does.
      const start = new Date(startISO);
      const end = new Date(endISO);
      const expectedDay = format(start, 'EEE, MMM d');
      const expectedStartTime = format(start, 'h:mm');
      const expectedEndTime = format(end, 'h:mm a');

      expect(result).toBe(`${expectedDay} \u2022 ${expectedStartTime} - ${expectedEndTime}`);
    });

    it('formats a session time range from Date objects', () => {
      const start = new Date('2026-02-18T14:00:00.000Z');
      const end = new Date('2026-02-18T15:30:00.000Z');
      const resultFromDates = formatSessionTime(start, end);
      const resultFromStrings = formatSessionTime(
        '2026-02-18T14:00:00.000Z',
        '2026-02-18T15:30:00.000Z'
      );
      // Both inputs should produce identical output
      expect(resultFromDates).toBe(resultFromStrings);
    });

    it('handles sessions that start in the evening', () => {
      const startISO = '2026-02-17T23:00:00.000Z';
      const endISO = '2026-02-18T00:30:00.000Z';
      const result = formatSessionTime(startISO, endISO);

      const start = new Date(startISO);
      const end = new Date(endISO);
      const expectedDay = format(start, 'EEE, MMM d');
      const expectedStartTime = format(start, 'h:mm');
      const expectedEndTime = format(end, 'h:mm a');

      expect(result).toBe(`${expectedDay} \u2022 ${expectedStartTime} - ${expectedEndTime}`);
    });

    it('always returns the expected format structure: day bullet start - end', () => {
      const result = formatSessionTime(
        '2026-02-20T09:00:00.000Z',
        '2026-02-20T10:00:00.000Z'
      );
      // Should match pattern: "EEE, MMM d \u2022 h:mm - h:mm a"
      expect(result).toMatch(/^\w{3}, \w{3} \d{1,2} \u2022 \d{1,2}:\d{2} - \d{1,2}:\d{2} [AP]M$/);
    });

    it('contains the bullet separator', () => {
      const result = formatSessionTime(
        '2026-02-20T09:00:00.000Z',
        '2026-02-20T10:00:00.000Z'
      );
      expect(result).toContain('\u2022');
    });

    it('contains the dash separating start and end times', () => {
      const result = formatSessionTime(
        '2026-02-20T09:00:00.000Z',
        '2026-02-20T10:00:00.000Z'
      );
      expect(result).toContain(' - ');
    });
  });

  // ---------------------------------------------------------------
  // formatRelativeTime
  // ---------------------------------------------------------------
  describe('formatRelativeTime', () => {
    it('returns "past" for a date in the past', () => {
      expect(formatRelativeTime('2026-02-17T11:00:00.000Z')).toBe('past');
    });

    it('returns "past" for a date far in the past', () => {
      expect(formatRelativeTime('2025-01-01T00:00:00.000Z')).toBe('past');
    });

    it('returns "in 1 minute" for 1 minute from now', () => {
      const oneMinuteFromNow = new Date(NOW.getTime() + 1 * 60 * 1000);
      expect(formatRelativeTime(oneMinuteFromNow)).toBe('in 1 minute');
    });

    it('returns "in 1 minute" for less than 1 minute from now', () => {
      const thirtySecondsFromNow = new Date(NOW.getTime() + 30 * 1000);
      // differenceInMinutes truncates, so 30s => 0 minutes, which is <= 1
      expect(formatRelativeTime(thirtySecondsFromNow)).toBe('in 1 minute');
    });

    it('returns "in 30 minutes" for 30 minutes from now', () => {
      const thirtyMinutesFromNow = new Date(NOW.getTime() + 30 * 60 * 1000);
      expect(formatRelativeTime(thirtyMinutesFromNow)).toBe('in 30 minutes');
    });

    it('returns "in 1 hour" for roughly 1 hour from now', () => {
      // 90 minutes from now -> hoursDiff = 1 (differenceInHours truncates)
      const ninetyMinutesFromNow = new Date(NOW.getTime() + 90 * 60 * 1000);
      expect(formatRelativeTime(ninetyMinutesFromNow)).toBe('in 1 hour');
    });

    it('returns "in 2 hours" for 2 hours from now', () => {
      const twoHoursFromNow = new Date(NOW.getTime() + 2 * 60 * 60 * 1000);
      expect(formatRelativeTime(twoHoursFromNow)).toBe('in 2 hours');
    });

    it('returns "tomorrow" for a date tomorrow', () => {
      // Feb 18, same time
      expect(formatRelativeTime('2026-02-18T12:00:00.000Z')).toBe('tomorrow');
    });

    it('returns "in N days" for dates within a week', () => {
      // 3 days from now (Feb 20)
      const threeDaysFromNow = new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(threeDaysFromNow)).toBe('in 3 days');
    });

    it('returns a formatted date for dates a week or more away', () => {
      // 14 days from now -> Mar 3
      const twoWeeksFromNow = new Date(NOW.getTime() + 14 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(twoWeeksFromNow)).toBe('Mar 3');
    });

    it('handles ISO string input for relative time', () => {
      // 5 hours from now via ISO string
      const fiveHoursFromNow = new Date(NOW.getTime() + 5 * 60 * 60 * 1000);
      expect(formatRelativeTime(fiveHoursFromNow.toISOString())).toBe('in 5 hours');
    });
  });

  // ---------------------------------------------------------------
  // isToday
  // ---------------------------------------------------------------
  describe('isToday', () => {
    it('returns true for the current time', () => {
      expect(isToday(NOW)).toBe(true);
    });

    it('returns true for an ISO string representing now', () => {
      expect(isToday(NOW.toISOString())).toBe(true);
    });

    it('returns false for yesterday', () => {
      const yesterday = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
      expect(isToday(yesterday)).toBe(false);
    });

    it('returns false for tomorrow', () => {
      const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
      expect(isToday(tomorrow)).toBe(false);
    });
  });

  // ---------------------------------------------------------------
  // isTomorrow
  // ---------------------------------------------------------------
  describe('isTomorrow', () => {
    it('returns true for 24 hours from now', () => {
      const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
      expect(isTomorrow(tomorrow)).toBe(true);
    });

    it('returns true for an ISO string representing tomorrow', () => {
      const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
      expect(isTomorrow(tomorrow.toISOString())).toBe(true);
    });

    it('returns false for today', () => {
      expect(isTomorrow(NOW)).toBe(false);
    });

    it('returns false for the day after tomorrow', () => {
      const dayAfterTomorrow = new Date(NOW.getTime() + 48 * 60 * 60 * 1000);
      expect(isTomorrow(dayAfterTomorrow)).toBe(false);
    });
  });
});
