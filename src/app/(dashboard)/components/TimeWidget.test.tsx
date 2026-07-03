import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatTime, formatDate } from './TimeWidget';

describe('TimeWidget', () => {
  describe('formatTime', () => {
    it('formats midnight as 00:00', () => {
      const date = new Date(2024, 0, 15, 0, 0, 0);
      expect(formatTime(date)).toBe('00:00');
    });

    it('formats noon as 12:00', () => {
      const date = new Date(2024, 0, 15, 12, 0, 0);
      expect(formatTime(date)).toBe('12:00');
    });

    it('zero-pads single digit hours and minutes', () => {
      const date = new Date(2024, 0, 15, 9, 5, 0);
      expect(formatTime(date)).toBe('09:05');
    });

    it('formats end of day correctly', () => {
      const date = new Date(2024, 0, 15, 23, 59, 0);
      expect(formatTime(date)).toBe('23:59');
    });

    it('formats double digit hours and minutes', () => {
      const date = new Date(2024, 0, 15, 14, 30, 0);
      expect(formatTime(date)).toBe('14:30');
    });
  });

  describe('formatDate', () => {
    it('formats a Monday in January', () => {
      // January 15, 2024 is a Monday
      const date = new Date(2024, 0, 15);
      expect(formatDate(date)).toBe('Monday, January 15');
    });

    it('formats a Sunday in December', () => {
      // December 1, 2024 is a Sunday
      const date = new Date(2024, 11, 1);
      expect(formatDate(date)).toBe('Sunday, December 1');
    });

    it('formats a Saturday in July', () => {
      // July 6, 2024 is a Saturday
      const date = new Date(2024, 6, 6);
      expect(formatDate(date)).toBe('Saturday, July 6');
    });

    it('includes day of week, month name, and day number', () => {
      const date = new Date(2024, 2, 20); // March 20, 2024 is a Wednesday
      const result = formatDate(date);
      expect(result).toContain('Wednesday');
      expect(result).toContain('March');
      expect(result).toContain('20');
    });

    it('formats single digit day numbers without padding', () => {
      const date = new Date(2024, 0, 1); // January 1, 2024 is a Monday
      expect(formatDate(date)).toBe('Monday, January 1');
    });
  });
});
