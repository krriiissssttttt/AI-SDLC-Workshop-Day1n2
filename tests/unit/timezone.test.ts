import { describe, it, expect } from 'vitest';
import {
  getSingaporeNow,
  formatSingaporeDate,
  getSingaporeTimezone,
  toSingaporeIsoString,
} from '../../lib/timezone';

describe('getSingaporeNow', () => {
  it('returns a Date object', () => {
    const result = getSingaporeNow();
    expect(result).toBeInstanceOf(Date);
  });

  it('returns approximately the current time', () => {
    const before = Date.now();
    const result = getSingaporeNow();
    const after = Date.now();
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });
});

describe('getSingaporeTimezone', () => {
  it('returns Asia/Singapore', () => {
    expect(getSingaporeTimezone()).toBe('Asia/Singapore');
  });

  it('returns the string literal type', () => {
    const tz: 'Asia/Singapore' = getSingaporeTimezone();
    expect(tz).toBe('Asia/Singapore');
  });
});

describe('formatSingaporeDate', () => {
  it('formats a date as a non-empty string', () => {
    const date = new Date('2024-01-15T10:00:00Z');
    const result = formatSingaporeDate(date);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes the year in the formatted date', () => {
    const date = new Date('2024-06-15T10:00:00Z');
    const result = formatSingaporeDate(date);
    expect(result).toContain('2024');
  });

  it('formats different dates differently', () => {
    const date1 = new Date('2024-01-01T00:00:00Z');
    const date2 = new Date('2024-12-31T00:00:00Z');
    expect(formatSingaporeDate(date1)).not.toBe(formatSingaporeDate(date2));
  });
});

describe('toSingaporeIsoString', () => {
  it('returns a string ending with +08:00', () => {
    const date = new Date('2024-01-15T10:00:00Z');
    const result = toSingaporeIsoString(date);
    expect(result).toMatch(/\+08:00$/);
  });

  it('adds 8 hours to UTC time for SGT', () => {
    // UTC 02:00 → SGT 10:00
    const date = new Date('2024-01-15T02:00:00.000Z');
    const result = toSingaporeIsoString(date);
    expect(result).toMatch(/2024-01-15T10:00:00\+08:00/);
  });

  it('handles midnight UTC correctly (SGT 08:00)', () => {
    const date = new Date('2024-03-20T00:00:00.000Z');
    const result = toSingaporeIsoString(date);
    expect(result).toMatch(/2024-03-20T08:00:00\+08:00/);
  });

  it('crosses date boundary: UTC 23:00 → SGT next day 07:00', () => {
    const date = new Date('2024-01-15T23:00:00.000Z');
    const result = toSingaporeIsoString(date);
    expect(result).toMatch(/2024-01-16T07:00:00\+08:00/);
  });

  it('handles leap year date', () => {
    const date = new Date('2024-02-29T12:00:00.000Z');
    const result = toSingaporeIsoString(date);
    expect(result).toContain('2024-02-29');
  });
});
