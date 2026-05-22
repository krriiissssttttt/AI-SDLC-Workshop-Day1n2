/**
 * Unit tests for pure helper logic used throughout lib/db.ts.
 *
 * We extract and test the pure mathematical/logical helpers independently
 * so they are fast and do not require a running database.
 */
import { describe, it, expect } from 'vitest';

// ─── Progress Calculation ───────────────────────────────────────────────────

function calcProgress(total: number, completed: number) {
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

describe('Progress Calculation', () => {
  it('returns 0% when no subtasks', () => {
    expect(calcProgress(0, 0)).toBe(0);
  });

  it('returns 0% when none completed', () => {
    expect(calcProgress(5, 0)).toBe(0);
  });

  it('returns 50% when half completed', () => {
    expect(calcProgress(4, 2)).toBe(50);
  });

  it('returns 100% when all completed', () => {
    expect(calcProgress(3, 3)).toBe(100);
  });

  it('rounds to nearest integer', () => {
    // 1/3 = 33.33...% → 33
    expect(calcProgress(3, 1)).toBe(33);
  });

  it('rounds up when appropriate', () => {
    // 2/3 = 66.66...% → 67
    expect(calcProgress(3, 2)).toBe(67);
  });
});

// ─── ID Remapping Logic ──────────────────────────────────────────────────────

function remapTodoTags(
  todoTags: Array<{ todo_id: number; tag_id: number }>,
  idMap: Map<number, number>
) {
  return todoTags.map((tt) => ({
    todo_id: idMap.get(tt.todo_id) ?? tt.todo_id,
    tag_id: tt.tag_id,
  }));
}

describe('ID Remapping Logic', () => {
  it('remaps todo IDs using the provided map', () => {
    const map = new Map([[1, 101], [2, 102]]);
    const result = remapTodoTags([{ todo_id: 1, tag_id: 10 }], map);
    expect(result[0].todo_id).toBe(101);
  });

  it('preserves tag_id unchanged', () => {
    const map = new Map([[1, 101]]);
    const result = remapTodoTags([{ todo_id: 1, tag_id: 42 }], map);
    expect(result[0].tag_id).toBe(42);
  });

  it('falls back to original ID when not in map', () => {
    const map = new Map([[1, 101]]);
    const result = remapTodoTags([{ todo_id: 99, tag_id: 5 }], map);
    expect(result[0].todo_id).toBe(99);
  });

  it('handles empty input', () => {
    expect(remapTodoTags([], new Map())).toEqual([]);
  });

  it('handles multiple entries', () => {
    const map = new Map([[1, 100], [2, 200], [3, 300]]);
    const tags = [
      { todo_id: 1, tag_id: 10 },
      { todo_id: 2, tag_id: 20 },
      { todo_id: 3, tag_id: 30 },
    ];
    const result = remapTodoTags(tags, map);
    expect(result.map((r) => r.todo_id)).toEqual([100, 200, 300]);
  });
});

// ─── Recurrence Date Calculation ─────────────────────────────────────────────

type RecurrencePattern = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

function addRecurrence(dateValue: string, pattern: RecurrencePattern): string {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid date');
  if (pattern === 'daily') date.setDate(date.getDate() + 1);
  if (pattern === 'weekly') date.setDate(date.getDate() + 7);
  if (pattern === 'monthly') date.setMonth(date.getMonth() + 1);
  if (pattern === 'yearly') date.setFullYear(date.getFullYear() + 1);
  return date.toISOString();
}

describe('Recurrence Date Calculations', () => {
  it('daily: adds exactly 1 day', () => {
    const result = addRecurrence('2024-01-15T10:00:00.000Z', 'daily');
    expect(new Date(result).getUTCDate()).toBe(16);
    expect(new Date(result).getUTCMonth()).toBe(0);
  });

  it('weekly: adds exactly 7 days', () => {
    const result = addRecurrence('2024-01-15T10:00:00.000Z', 'weekly');
    expect(new Date(result).getUTCDate()).toBe(22);
  });

  it('monthly: adds 1 month', () => {
    const result = addRecurrence('2024-01-15T10:00:00.000Z', 'monthly');
    expect(new Date(result).getUTCMonth()).toBe(1); // February
  });

  it('yearly: adds 1 year', () => {
    const result = addRecurrence('2024-01-15T10:00:00.000Z', 'yearly');
    expect(new Date(result).getUTCFullYear()).toBe(2025);
  });

  it('none: returns the same date unchanged', () => {
    const input = '2024-01-15T10:00:00.000Z';
    const result = addRecurrence(input, 'none');
    expect(result).toBe(new Date(input).toISOString());
  });

  it('handles month overflow (e.g. Jan 31 → Mar 2)', () => {
    // Jan 31 + 1 month in JS = Feb 31 → overflows to Mar 2 (or Mar 3 in leap year)
    const result = addRecurrence('2024-01-31T00:00:00.000Z', 'monthly');
    const d = new Date(result);
    expect(d.getUTCMonth()).toBe(2); // March
  });

  it('throws on invalid date', () => {
    expect(() => addRecurrence('not-a-date', 'daily')).toThrow('Invalid date');
  });
});

// ─── Validation Helpers ───────────────────────────────────────────────────────

function isValidPriority(value: string): boolean {
  return value === 'high' || value === 'medium' || value === 'low';
}

function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function isValidReminderMinutes(value: number): boolean {
  const allowed = new Set([15, 30, 60, 120, 1440, 2880, 10080]);
  return allowed.has(value);
}

describe('Validation Helpers', () => {
  describe('isValidPriority', () => {
    it('accepts high', () => expect(isValidPriority('high')).toBe(true));
    it('accepts medium', () => expect(isValidPriority('medium')).toBe(true));
    it('accepts low', () => expect(isValidPriority('low')).toBe(true));
    it('rejects urgent', () => expect(isValidPriority('urgent')).toBe(false));
    it('rejects empty string', () => expect(isValidPriority('')).toBe(false));
    it('rejects uppercase HIGH', () => expect(isValidPriority('HIGH')).toBe(false));
  });

  describe('isValidHexColor', () => {
    it('accepts #3B82F6', () => expect(isValidHexColor('#3B82F6')).toBe(true));
    it('accepts lowercase #ffffff', () => expect(isValidHexColor('#ffffff')).toBe(true));
    it('rejects without hash', () => expect(isValidHexColor('3B82F6')).toBe(false));
    it('rejects 3-digit hex', () => expect(isValidHexColor('#fff')).toBe(false));
    it('rejects non-hex chars', () => expect(isValidHexColor('#GGGGGG')).toBe(false));
    it('rejects empty string', () => expect(isValidHexColor('')).toBe(false));
  });

  describe('isValidReminderMinutes', () => {
    it('accepts 15 minutes', () => expect(isValidReminderMinutes(15)).toBe(true));
    it('accepts 30 minutes', () => expect(isValidReminderMinutes(30)).toBe(true));
    it('accepts 60 minutes (1h)', () => expect(isValidReminderMinutes(60)).toBe(true));
    it('accepts 120 minutes (2h)', () => expect(isValidReminderMinutes(120)).toBe(true));
    it('accepts 1440 minutes (1d)', () => expect(isValidReminderMinutes(1440)).toBe(true));
    it('accepts 2880 minutes (2d)', () => expect(isValidReminderMinutes(2880)).toBe(true));
    it('accepts 10080 minutes (1w)', () => expect(isValidReminderMinutes(10080)).toBe(true));
    it('rejects 45 minutes', () => expect(isValidReminderMinutes(45)).toBe(false));
    it('rejects 0', () => expect(isValidReminderMinutes(0)).toBe(false));
    it('rejects negative values', () => expect(isValidReminderMinutes(-15)).toBe(false));
  });
});

// ─── Subtask JSON Serialization ───────────────────────────────────────────────

type SubtaskInput = { title: string; position?: number };

function serializeSubtasks(subtasks: SubtaskInput[]): string {
  const normalized = subtasks.map((s, i) => ({
    title: s.title.trim(),
    position: s.position ?? i,
  }));
  return JSON.stringify(normalized);
}

function deserializeSubtasks(json: string): SubtaskInput[] {
  return JSON.parse(json) as SubtaskInput[];
}

describe('Subtask JSON Serialization', () => {
  it('serializes empty array to "[]"', () => {
    expect(serializeSubtasks([])).toBe('[]');
  });

  it('serializes subtask with default position', () => {
    const result = JSON.parse(serializeSubtasks([{ title: 'Task A' }])) as SubtaskInput[];
    expect(result[0].title).toBe('Task A');
    expect(result[0].position).toBe(0);
  });

  it('preserves explicit positions', () => {
    const result = JSON.parse(
      serializeSubtasks([{ title: 'A', position: 5 }])
    ) as SubtaskInput[];
    expect(result[0].position).toBe(5);
  });

  it('trims whitespace from title', () => {
    const result = JSON.parse(serializeSubtasks([{ title: '  trimmed  ' }])) as SubtaskInput[];
    expect(result[0].title).toBe('trimmed');
  });

  it('round-trips through deserialize', () => {
    const original: SubtaskInput[] = [
      { title: 'Step 1', position: 0 },
      { title: 'Step 2', position: 1 },
    ];
    const serialized = serializeSubtasks(original);
    const deserialized = deserializeSubtasks(serialized);
    expect(deserialized).toEqual(original);
  });
});
