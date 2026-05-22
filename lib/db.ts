import Database from 'better-sqlite3';
import path from 'node:path';
import { getSingaporeNow, getSingaporeTimezone, toSingaporeIsoString } from '@/lib/timezone';

export type Priority = 'high' | 'medium' | 'low';
export type RecurrencePattern = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Todo {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  completed: 0 | 1;
  due_date: string | null;
  priority: Priority;
  is_recurring: 0 | 1;
  recurrence_pattern: RecurrencePattern;
  reminder_minutes: number | null;
  last_notification_sent: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed: 0 | 1;
  position: number;
  created_at: string;
}

export interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface TodoTag {
  todo_id: number;
  tag_id: number;
}

export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface Authenticator {
  id: number;
  user_id: number;
  credential_id: string;
  credential_public_key: string;
  counter: number | null;
  credential_device_type: string | null;
  credential_backed_up: 0 | 1 | null;
  transports: string | null;
  created_at: string;
}

export interface Template {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  category: string | null;
  title: string;
  default_description: string | null;
  priority: Priority;
  is_recurring: 0 | 1;
  recurrence_pattern: RecurrencePattern;
  reminder_minutes: number | null;
  due_date_offset_days: number | null;
  subtasks_json: string;
  created_at: string;
  updated_at: string;
}

export interface Holiday {
  id: number;
  date: string;
  name: string;
  created_at: string;
}

export interface TodoDetails extends Todo {
  tags: Tag[];
  subtasks: Subtask[];
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
}

export interface CreateTodoInput {
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority?: Priority;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern;
  reminder_minutes?: number | null;
  tag_ids?: number[];
}

export interface UpdateTodoInput {
  title?: string;
  description?: string | null;
  due_date?: string | null;
  priority?: Priority;
  completed?: boolean;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern;
  reminder_minutes?: number | null;
  tag_ids?: number[];
}

export interface CreateTemplateInput {
  name: string;
  description?: string | null;
  category?: string | null;
  title: string;
  default_description?: string | null;
  priority?: Priority;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern;
  reminder_minutes?: number | null;
  due_date_offset_days?: number | null;
  subtasks?: Array<{ title: string; position?: number }>;
}

export interface UseTemplateInput {
  due_date?: string | null;
}

export interface ExportPayloadV1 {
  version: '1.0';
  exported_at: string;
  timezone: 'Asia/Singapore';
  app: 'todo-app';
  data: {
    todos: Array<Omit<Todo, 'user_id'>>;
    subtasks: Subtask[];
    tags: Array<Omit<Tag, 'user_id'>>;
    todo_tags: TodoTag[];
  };
}

export interface ImportRequestV1 {
  mode?: 'merge' | 'replace';
  payload: ExportPayloadV1;
}

export interface ImportSummary {
  imported_todos: number;
  imported_subtasks: number;
  imported_tags: number;
  imported_relationships: number;
  skipped_duplicates: number;
  mode: 'merge' | 'replace';
}

const DATABASE_PATH = path.join(process.cwd(), 'todos.db');
const db = new Database(DATABASE_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const REMINDER_OPTIONS = new Set([15, 30, 60, 120, 1440, 2880, 10080]);

function isValidPriority(value: string): value is Priority {
  return value === 'high' || value === 'medium' || value === 'low';
}

function isValidRecurrencePattern(value: string): value is RecurrencePattern {
  return value === 'none' || value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'yearly';
}

function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

function toIsoNow(): string {
  return toSingaporeIsoString(getSingaporeNow());
}

function getReminderOrNull(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!REMINDER_OPTIONS.has(value)) {
    throw new Error('Invalid reminder value.');
  }

  return value;
}

function getRecurrenceValues(
  isRecurringInput: boolean | undefined,
  patternInput: RecurrencePattern | undefined
): { is_recurring: 0 | 1; recurrence_pattern: RecurrencePattern } {
  const pattern = patternInput ?? 'none';
  const isRecurring = isRecurringInput ?? pattern !== 'none';

  if (!isValidRecurrencePattern(pattern)) {
    throw new Error('Invalid recurrence pattern.');
  }

  if (!isRecurring || pattern === 'none') {
    return { is_recurring: 0, recurrence_pattern: 'none' };
  }

  return { is_recurring: 1, recurrence_pattern: pattern };
}

function addRecurrence(dateValue: string, pattern: RecurrencePattern): string {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid due date for recurrence.');
  }

  if (pattern === 'daily') {
    date.setDate(date.getDate() + 1);
  }

  if (pattern === 'weekly') {
    date.setDate(date.getDate() + 7);
  }

  if (pattern === 'monthly') {
    date.setMonth(date.getMonth() + 1);
  }

  if (pattern === 'yearly') {
    date.setFullYear(date.getFullYear() + 1);
  }

  return date.toISOString();
}

function assertTodoTitle(title: string): string {
  const normalized = title.trim();

  if (!normalized || normalized.length > 200) {
    throw new Error('Todo title must be between 1 and 200 characters.');
  }

  return normalized;
}

function assertSubtaskTitle(title: string): string {
  const normalized = title.trim();

  if (!normalized || normalized.length > 200) {
    throw new Error('Subtask title must be between 1 and 200 characters.');
  }

  return normalized;
}

function assertDueDate(dueDate: string | null | undefined): string | null {
  if (dueDate === null || dueDate === undefined || dueDate === '') {
    return null;
  }

  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Due date is invalid.');
  }

  return parsed.toISOString();
}

function initializeSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS authenticators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      credential_id TEXT NOT NULL UNIQUE,
      credential_public_key TEXT NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      credential_device_type TEXT,
      credential_backed_up INTEGER DEFAULT 0,
      transports TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      due_date TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      is_recurring INTEGER NOT NULL DEFAULT 0,
      recurrence_pattern TEXT NOT NULL DEFAULT 'none',
      reminder_minutes INTEGER,
      last_notification_sent TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      todo_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#64748b',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, name),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS todo_tags (
      todo_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (todo_id, tag_id),
      FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      title TEXT NOT NULL,
      default_description TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      is_recurring INTEGER NOT NULL DEFAULT 0,
      recurrence_pattern TEXT NOT NULL DEFAULT 'none',
      reminder_minutes INTEGER,
      due_date_offset_days INTEGER,
      subtasks_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
    CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
    CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id ON subtasks(todo_id);
    CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
    CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
  `);

  const migrationStatements = [
    "ALTER TABLE todos ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE todos ADD COLUMN last_notification_sent TEXT",
    "ALTER TABLE templates ADD COLUMN category TEXT",
  ];

  for (const statement of migrationStatements) {
    try {
      db.exec(statement);
    } catch {
      // ignore migration errors when column already exists
    }
  }
}

function seedHolidays() {
  const baseYear = getSingaporeNow().getFullYear();
  const rows: Array<{ date: string; name: string }> = [];

  // Seed a rolling 21-year fixed-date window to support calendar navigation and recurring planning.
  for (let year = baseYear - 10; year <= baseYear + 10; year += 1) {
    rows.push(
      { date: `${year}-01-01`, name: "New Year's Day" },
      { date: `${year}-05-01`, name: 'Labour Day' },
      { date: `${year}-08-09`, name: 'National Day' },
      { date: `${year}-12-25`, name: 'Christmas Day' }
    );
  }

  const insert = db.prepare('INSERT OR IGNORE INTO holidays (date, name) VALUES (?, ?)');
  const transaction = db.transaction(() => {
    for (const row of rows) {
      insert.run(row.date, row.name);
    }
  });

  transaction();
}

initializeSchema();
seedHolidays();

export function createUser(username: string): number {
  const result = db.prepare('INSERT INTO users (username) VALUES (?)').run(username.trim());
  return Number(result.lastInsertRowid);
}

export function findUserByUsername(username: string): { id: number; username: string } | null {
  const user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(username.trim()) as
    | { id: number; username: string }
    | undefined;

  return user ?? null;
}

export function findUserById(userId: number): { id: number; username: string } | null {
  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId) as
    | { id: number; username: string }
    | undefined;

  return user ?? null;
}

export function createAuthenticator(input: {
  userId: number;
  credentialId: string;
  credentialPublicKey: string;
  counter: number;
  credentialDeviceType: string | null;
  credentialBackedUp: boolean;
  transports: string | null;
}): number {
  const result = db
    .prepare(
      `INSERT INTO authenticators (
        user_id,
        credential_id,
        credential_public_key,
        counter,
        credential_device_type,
        credential_backed_up,
        transports
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.userId,
      input.credentialId,
      input.credentialPublicKey,
      input.counter,
      input.credentialDeviceType,
      input.credentialBackedUp ? 1 : 0,
      input.transports
    );

  return Number(result.lastInsertRowid);
}

export function findAuthenticatorByCredentialId(credentialId: string): Authenticator | null {
  const authenticator = db
    .prepare(
      `SELECT id, user_id, credential_id, credential_public_key, counter, credential_device_type, credential_backed_up, transports, created_at
       FROM authenticators
       WHERE credential_id = ?`
    )
    .get(credentialId) as Authenticator | undefined;

  return authenticator ?? null;
}

export function listAuthenticatorsByUserId(userId: number): Authenticator[] {
  return db
    .prepare(
      `SELECT id, user_id, credential_id, credential_public_key, counter, credential_device_type, credential_backed_up, transports, created_at
       FROM authenticators
       WHERE user_id = ?
       ORDER BY id ASC`
    )
    .all(userId) as Authenticator[];
}

export function updateAuthenticatorCounter(credentialId: string, counter: number): void {
  db.prepare('UPDATE authenticators SET counter = ? WHERE credential_id = ?').run(counter, credentialId);
}

export function listTodosForUser(userId: number): Todo[] {
  return db
    .prepare(
      `SELECT id, user_id, title, description, completed, due_date, priority, is_recurring, recurrence_pattern,
              reminder_minutes, last_notification_sent, created_at, updated_at
       FROM todos
       WHERE user_id = ?
       ORDER BY
         CASE completed WHEN 1 THEN 1 ELSE 0 END ASC,
         CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END ASC,
         CASE WHEN due_date IS NULL THEN 1 ELSE 0 END ASC,
         due_date ASC,
         id DESC`
    )
    .all(userId) as Todo[];
}

export function getTodoByIdForUser(userId: number, todoId: number): Todo | null {
  const todo = db
    .prepare(
      `SELECT id, user_id, title, description, completed, due_date, priority, is_recurring, recurrence_pattern,
              reminder_minutes, last_notification_sent, created_at, updated_at
       FROM todos
       WHERE id = ? AND user_id = ?`
    )
    .get(todoId, userId) as Todo | undefined;

  return todo ?? null;
}

export function listTagsForTodo(todoId: number): Tag[] {
  return db
    .prepare(
      `SELECT tg.id, tg.user_id, tg.name, tg.color, tg.created_at
       FROM tags tg
       INNER JOIN todo_tags tt ON tt.tag_id = tg.id
       WHERE tt.todo_id = ?
       ORDER BY tg.name ASC`
    )
    .all(todoId) as Tag[];
}

export function listSubtasksForTodo(todoId: number): Subtask[] {
  return db
    .prepare(
      `SELECT id, todo_id, title, completed, position, created_at
       FROM subtasks
       WHERE todo_id = ?
       ORDER BY position ASC, id ASC`
    )
    .all(todoId) as Subtask[];
}

export function getTodoDetailsById(userId: number, todoId: number): TodoDetails | null {
  const todo = getTodoByIdForUser(userId, todoId);
  if (!todo) {
    return null;
  }

  const subtasks = listSubtasksForTodo(todo.id);
  const completedSubtasks = subtasks.filter((subtask) => subtask.completed === 1).length;

  return {
    ...todo,
    tags: listTagsForTodo(todo.id),
    subtasks,
    progress: {
      total: subtasks.length,
      completed: completedSubtasks,
      percentage: subtasks.length === 0 ? 0 : Math.round((completedSubtasks / subtasks.length) * 100),
    },
  };
}

export function listTodoDetailsForUser(userId: number): TodoDetails[] {
  const todos = listTodosForUser(userId);
  return todos.map((todo) => {
    const subtasks = listSubtasksForTodo(todo.id);
    const completedSubtasks = subtasks.filter((subtask) => subtask.completed === 1).length;

    return {
      ...todo,
      tags: listTagsForTodo(todo.id),
      subtasks,
      progress: {
        total: subtasks.length,
        completed: completedSubtasks,
        percentage: subtasks.length === 0 ? 0 : Math.round((completedSubtasks / subtasks.length) * 100),
      },
    };
  });
}

export function createTodo(userId: number, input: CreateTodoInput): TodoDetails {
  const title = assertTodoTitle(input.title);
  const description = input.description?.trim() || null;
  const dueDate = assertDueDate(input.due_date);
  const priority = input.priority ?? 'medium';
  const reminder = getReminderOrNull(input.reminder_minutes);

  if (!isValidPriority(priority)) {
    throw new Error('Invalid priority.');
  }

  const recurrence = getRecurrenceValues(input.is_recurring, input.recurrence_pattern);
  if (recurrence.is_recurring === 1 && !dueDate) {
    throw new Error('Recurring todos require a due date.');
  }

  const now = toIsoNow();

  const transaction = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO todos (
          user_id, title, description, completed, due_date, priority,
          is_recurring, recurrence_pattern, reminder_minutes, created_at, updated_at
        ) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        userId,
        title,
        description,
        dueDate,
        priority,
        recurrence.is_recurring,
        recurrence.recurrence_pattern,
        reminder,
        now,
        now
      );

    const todoId = Number(result.lastInsertRowid);
    if (input.tag_ids && input.tag_ids.length > 0) {
      setTodoTags(userId, todoId, input.tag_ids);
    }

    return todoId;
  });

  const id = transaction();
  const created = getTodoDetailsById(userId, id);

  if (!created) {
    throw new Error('Failed to load created todo.');
  }

  return created;
}

export function updateTodo(userId: number, todoId: number, input: UpdateTodoInput): { todo: TodoDetails; spawnedTodo?: TodoDetails } {
  const existing = getTodoByIdForUser(userId, todoId);
  if (!existing) {
    throw new Error('Todo not found.');
  }

  const title = input.title === undefined ? existing.title : assertTodoTitle(input.title);
  const description = input.description === undefined ? existing.description : input.description?.trim() || null;
  const dueDate = input.due_date === undefined ? existing.due_date : assertDueDate(input.due_date);
  const priority = input.priority ?? existing.priority;

  if (!isValidPriority(priority)) {
    throw new Error('Invalid priority.');
  }

  const recurrence = getRecurrenceValues(input.is_recurring, input.recurrence_pattern ?? existing.recurrence_pattern);
  const reminder = input.reminder_minutes === undefined ? existing.reminder_minutes : getReminderOrNull(input.reminder_minutes);
  const completed = input.completed === undefined ? existing.completed : input.completed ? 1 : 0;

  if (recurrence.is_recurring === 1 && !dueDate) {
    throw new Error('Recurring todos require a due date.');
  }

  const now = toIsoNow();
  let spawnedTodoId: number | undefined;

  const transaction = db.transaction(() => {
    db.prepare(
      `UPDATE todos
       SET title = ?, description = ?, due_date = ?, priority = ?, completed = ?,
           is_recurring = ?, recurrence_pattern = ?, reminder_minutes = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(
      title,
      description,
      dueDate,
      priority,
      completed,
      recurrence.is_recurring,
      recurrence.recurrence_pattern,
      reminder,
      now,
      todoId,
      userId
    );

    if (input.tag_ids) {
      setTodoTags(userId, todoId, input.tag_ids);
    }

    const justCompleted = existing.completed === 0 && completed === 1;
    if (justCompleted && recurrence.is_recurring === 1 && dueDate && recurrence.recurrence_pattern !== 'none') {
      const nextDueDate = addRecurrence(dueDate, recurrence.recurrence_pattern);
      const inserted = db
        .prepare(
          `INSERT INTO todos (
            user_id, title, description, completed, due_date, priority,
            is_recurring, recurrence_pattern, reminder_minutes, created_at, updated_at
          ) VALUES (?, ?, ?, 0, ?, ?, 1, ?, ?, ?, ?)`
        )
        .run(userId, title, description, nextDueDate, priority, recurrence.recurrence_pattern, reminder, now, now);

      const newTodoId = Number(inserted.lastInsertRowid);
      spawnedTodoId = newTodoId;

      const tagIds = db
        .prepare('SELECT tag_id FROM todo_tags WHERE todo_id = ?')
        .all(todoId) as Array<{ tag_id: number }>;

      const insertTodoTag = db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)');
      for (const tagId of tagIds) {
        insertTodoTag.run(newTodoId, tagId.tag_id);
      }
    }
  });

  transaction();

  const todo = getTodoDetailsById(userId, todoId);
  if (!todo) {
    throw new Error('Todo not found.');
  }

  const spawnedTodo = spawnedTodoId ? getTodoDetailsById(userId, spawnedTodoId) ?? undefined : undefined;
  return { todo, spawnedTodo };
}

export function deleteTodo(userId: number, todoId: number): void {
  const result = db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?').run(todoId, userId);
  if (result.changes === 0) {
    throw new Error('Todo not found.');
  }
}

export function createSubtask(userId: number, todoId: number, title: string): Subtask {
  const todo = getTodoByIdForUser(userId, todoId);
  if (!todo) {
    throw new Error('Todo not found.');
  }

  const normalized = assertSubtaskTitle(title);
  const currentMax = db.prepare('SELECT COALESCE(MAX(position), -1) as max_position FROM subtasks WHERE todo_id = ?').get(todoId) as {
    max_position: number;
  };

  const result = db
    .prepare('INSERT INTO subtasks (todo_id, title, completed, position, created_at) VALUES (?, ?, 0, ?, ?)')
    .run(todoId, normalized, currentMax.max_position + 1, toIsoNow());

  const subtask = db
    .prepare('SELECT id, todo_id, title, completed, position, created_at FROM subtasks WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as Subtask | undefined;

  if (!subtask) {
    throw new Error('Failed to create subtask.');
  }

  return subtask;
}

export function updateSubtask(userId: number, subtaskId: number, input: { title?: string; completed?: boolean }): Subtask {
  const existing = db
    .prepare(
      `SELECT s.id, s.todo_id, s.title, s.completed, s.position, s.created_at, t.user_id
       FROM subtasks s
       INNER JOIN todos t ON t.id = s.todo_id
       WHERE s.id = ?`
    )
    .get(subtaskId) as (Subtask & { user_id: number }) | undefined;

  if (!existing || existing.user_id !== userId) {
    throw new Error('Subtask not found.');
  }

  const title = input.title === undefined ? existing.title : assertSubtaskTitle(input.title);
  const completed = input.completed === undefined ? existing.completed : input.completed ? 1 : 0;

  db.prepare('UPDATE subtasks SET title = ?, completed = ? WHERE id = ?').run(title, completed, subtaskId);

  const subtask = db
    .prepare('SELECT id, todo_id, title, completed, position, created_at FROM subtasks WHERE id = ?')
    .get(subtaskId) as Subtask | undefined;

  if (!subtask) {
    throw new Error('Subtask not found.');
  }

  return subtask;
}

export function deleteSubtask(userId: number, subtaskId: number): void {
  const belongs = db
    .prepare(
      `SELECT s.id
       FROM subtasks s
       INNER JOIN todos t ON t.id = s.todo_id
       WHERE s.id = ? AND t.user_id = ?`
    )
    .get(subtaskId, userId) as { id: number } | undefined;

  if (!belongs) {
    throw new Error('Subtask not found.');
  }

  db.prepare('DELETE FROM subtasks WHERE id = ?').run(subtaskId);
}

export function listTagsForUser(userId: number): Tag[] {
  return db
    .prepare('SELECT id, user_id, name, color, created_at FROM tags WHERE user_id = ? ORDER BY name ASC')
    .all(userId) as Tag[];
}

export function createTag(userId: number, input: { name: string; color: string }): Tag {
  const name = input.name.trim();
  if (!name || name.length > 50) {
    throw new Error('Tag name must be between 1 and 50 characters.');
  }

  if (!isValidHexColor(input.color)) {
    throw new Error('Tag color must be a 6-digit hex value.');
  }

  const existing = db
    .prepare('SELECT id FROM tags WHERE user_id = ? AND lower(trim(name)) = ?')
    .get(userId, normalizeTagName(name)) as { id: number } | undefined;

  if (existing) {
    throw new Error('Tag name already exists.');
  }

  const result = db
    .prepare('INSERT INTO tags (user_id, name, color, created_at) VALUES (?, ?, ?, ?)')
    .run(userId, name, input.color, toIsoNow());

  const created = db
    .prepare('SELECT id, user_id, name, color, created_at FROM tags WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as Tag | undefined;

  if (!created) {
    throw new Error('Failed to create tag.');
  }

  return created;
}

export function updateTag(userId: number, tagId: number, input: { name?: string; color?: string }): Tag {
  const existing = db
    .prepare('SELECT id, user_id, name, color, created_at FROM tags WHERE id = ? AND user_id = ?')
    .get(tagId, userId) as Tag | undefined;

  if (!existing) {
    throw new Error('Tag not found.');
  }

  const name = input.name === undefined ? existing.name : input.name.trim();
  if (!name || name.length > 50) {
    throw new Error('Tag name must be between 1 and 50 characters.');
  }

  const color = input.color ?? existing.color;
  if (!isValidHexColor(color)) {
    throw new Error('Tag color must be a 6-digit hex value.');
  }

  const duplicate = db
    .prepare('SELECT id FROM tags WHERE user_id = ? AND lower(trim(name)) = ? AND id != ?')
    .get(userId, normalizeTagName(name), tagId) as { id: number } | undefined;

  if (duplicate) {
    throw new Error('Tag name already exists.');
  }

  db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ? AND user_id = ?').run(name, color, tagId, userId);

  const updated = db
    .prepare('SELECT id, user_id, name, color, created_at FROM tags WHERE id = ?')
    .get(tagId) as Tag | undefined;

  if (!updated) {
    throw new Error('Tag not found.');
  }

  return updated;
}

export function deleteTag(userId: number, tagId: number): void {
  const result = db.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').run(tagId, userId);
  if (result.changes === 0) {
    throw new Error('Tag not found.');
  }
}

export function setTodoTags(userId: number, todoId: number, tagIds: number[]): void {
  const todo = getTodoByIdForUser(userId, todoId);
  if (!todo) {
    throw new Error('Todo not found.');
  }

  const uniqueTagIds = [...new Set(tagIds)];
  if (uniqueTagIds.length > 0) {
    const allowedTagIds = db
      .prepare(`SELECT id FROM tags WHERE user_id = ? AND id IN (${uniqueTagIds.map(() => '?').join(',')})`)
      .all(userId, ...uniqueTagIds) as Array<{ id: number }>;

    if (allowedTagIds.length !== uniqueTagIds.length) {
      throw new Error('One or more tags are invalid.');
    }
  }

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM todo_tags WHERE todo_id = ?').run(todoId);
    const insert = db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)');
    for (const tagId of uniqueTagIds) {
      insert.run(todoId, tagId);
    }
  });

  transaction();
}

export function listTemplatesForUser(userId: number): Template[] {
  return db
    .prepare(
      `SELECT id, user_id, name, description, category, title, default_description, priority, is_recurring,
              recurrence_pattern, reminder_minutes, due_date_offset_days, subtasks_json, created_at, updated_at
       FROM templates
       WHERE user_id = ?
       ORDER BY updated_at DESC, id DESC`
    )
    .all(userId) as Template[];
}

export function createTemplate(userId: number, input: CreateTemplateInput): Template {
  const name = input.name.trim();
  const title = assertTodoTitle(input.title);

  if (!name || name.length > 100) {
    throw new Error('Template name must be between 1 and 100 characters.');
  }

  const priority = input.priority ?? 'medium';
  if (!isValidPriority(priority)) {
    throw new Error('Invalid priority.');
  }

  const recurrence = getRecurrenceValues(input.is_recurring, input.recurrence_pattern);
  const reminder = getReminderOrNull(input.reminder_minutes);
  const subtasks = (input.subtasks ?? []).map((subtask, index) => ({
    title: assertSubtaskTitle(subtask.title),
    position: subtask.position ?? index,
  }));

  const now = toIsoNow();
  const result = db
    .prepare(
      `INSERT INTO templates (
        user_id, name, description, category, title, default_description, priority,
        is_recurring, recurrence_pattern, reminder_minutes, due_date_offset_days,
        subtasks_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      name,
      input.description?.trim() || null,
      input.category?.trim() || null,
      title,
      input.default_description?.trim() || null,
      priority,
      recurrence.is_recurring,
      recurrence.recurrence_pattern,
      reminder,
      input.due_date_offset_days ?? null,
      JSON.stringify(subtasks),
      now,
      now
    );

  const template = db
    .prepare(
      `SELECT id, user_id, name, description, category, title, default_description, priority, is_recurring,
              recurrence_pattern, reminder_minutes, due_date_offset_days, subtasks_json, created_at, updated_at
       FROM templates
       WHERE id = ?`
    )
    .get(Number(result.lastInsertRowid)) as Template | undefined;

  if (!template) {
    throw new Error('Failed to create template.');
  }

  return template;
}

export function updateTemplate(userId: number, templateId: number, input: Partial<CreateTemplateInput>): Template {
  const existing = db
    .prepare(
      `SELECT id, user_id, name, description, category, title, default_description, priority, is_recurring,
              recurrence_pattern, reminder_minutes, due_date_offset_days, subtasks_json, created_at, updated_at
       FROM templates
       WHERE id = ? AND user_id = ?`
    )
    .get(templateId, userId) as Template | undefined;

  if (!existing) {
    throw new Error('Template not found.');
  }

  const name = input.name === undefined ? existing.name : input.name.trim();
  const title = input.title === undefined ? existing.title : assertTodoTitle(input.title);
  const priority = input.priority ?? existing.priority;

  if (!name || name.length > 100) {
    throw new Error('Template name must be between 1 and 100 characters.');
  }

  if (!isValidPriority(priority)) {
    throw new Error('Invalid priority.');
  }

  const recurrence = getRecurrenceValues(
    input.is_recurring ?? existing.is_recurring === 1,
    input.recurrence_pattern ?? existing.recurrence_pattern
  );

  const reminder = input.reminder_minutes === undefined ? existing.reminder_minutes : getReminderOrNull(input.reminder_minutes);
  const subtasks =
    input.subtasks === undefined
      ? existing.subtasks_json
      : JSON.stringify(
          input.subtasks.map((subtask, index) => ({
            title: assertSubtaskTitle(subtask.title),
            position: subtask.position ?? index,
          }))
        );

  db.prepare(
    `UPDATE templates
     SET name = ?, description = ?, category = ?, title = ?, default_description = ?, priority = ?,
         is_recurring = ?, recurrence_pattern = ?, reminder_minutes = ?, due_date_offset_days = ?,
         subtasks_json = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  ).run(
    name,
    input.description === undefined ? existing.description : input.description?.trim() || null,
    input.category === undefined ? existing.category : input.category?.trim() || null,
    title,
    input.default_description === undefined ? existing.default_description : input.default_description?.trim() || null,
    priority,
    recurrence.is_recurring,
    recurrence.recurrence_pattern,
    reminder,
    input.due_date_offset_days === undefined ? existing.due_date_offset_days : input.due_date_offset_days,
    subtasks,
    toIsoNow(),
    templateId,
    userId
  );

  const updated = db
    .prepare(
      `SELECT id, user_id, name, description, category, title, default_description, priority, is_recurring,
              recurrence_pattern, reminder_minutes, due_date_offset_days, subtasks_json, created_at, updated_at
       FROM templates
       WHERE id = ?`
    )
    .get(templateId) as Template | undefined;

  if (!updated) {
    throw new Error('Template not found.');
  }

  return updated;
}

export function deleteTemplate(userId: number, templateId: number): void {
  const result = db.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?').run(templateId, userId);
  if (result.changes === 0) {
    throw new Error('Template not found.');
  }
}

export function useTemplate(userId: number, templateId: number, input: UseTemplateInput): TodoDetails {
  const template = db
    .prepare(
      `SELECT id, user_id, name, description, category, title, default_description, priority, is_recurring,
              recurrence_pattern, reminder_minutes, due_date_offset_days, subtasks_json, created_at, updated_at
       FROM templates
       WHERE id = ? AND user_id = ?`
    )
    .get(templateId, userId) as Template | undefined;

  if (!template) {
    throw new Error('Template not found.');
  }

  const baseDate = input.due_date ? assertDueDate(input.due_date) : null;
  let dueDate: string | null = baseDate;

  if (!dueDate && template.due_date_offset_days !== null) {
    const now = getSingaporeNow();
    now.setDate(now.getDate() + template.due_date_offset_days);
    dueDate = now.toISOString();
  }

  const created = createTodo(userId, {
    title: template.title,
    description: template.default_description,
    due_date: dueDate,
    priority: template.priority,
    is_recurring: template.is_recurring === 1,
    recurrence_pattern: template.recurrence_pattern,
    reminder_minutes: template.reminder_minutes,
  });

  const subtasks = JSON.parse(template.subtasks_json) as Array<{ title: string; position?: number }>;
  if (Array.isArray(subtasks)) {
    const insert = db.prepare('INSERT INTO subtasks (todo_id, title, completed, position, created_at) VALUES (?, ?, 0, ?, ?)');
    const transaction = db.transaction(() => {
      for (const [index, subtask] of subtasks.entries()) {
        insert.run(created.id, assertSubtaskTitle(subtask.title), subtask.position ?? index, toIsoNow());
      }
    });

    transaction();
  }

  const withSubtasks = getTodoDetailsById(userId, created.id);
  if (!withSubtasks) {
    throw new Error('Failed to create todo from template.');
  }

  return withSubtasks;
}

export function listHolidays(startDate?: string, endDate?: string): Holiday[] {
  if (startDate && endDate) {
    return db
      .prepare('SELECT id, date, name, created_at FROM holidays WHERE date BETWEEN ? AND ? ORDER BY date ASC')
      .all(startDate, endDate) as Holiday[];
  }

  return db.prepare('SELECT id, date, name, created_at FROM holidays ORDER BY date ASC').all() as Holiday[];
}

export function getTodosNeedingNotification(userId: number, nowIso = toIsoNow()): Todo[] {
  return db
    .prepare(
      `SELECT id, user_id, title, description, completed, due_date, priority, is_recurring, recurrence_pattern,
              reminder_minutes, last_notification_sent, created_at, updated_at
       FROM todos
       WHERE user_id = ?
         AND completed = 0
         AND due_date IS NOT NULL
         AND reminder_minutes IS NOT NULL
         AND datetime(due_date, printf('-%d minutes', reminder_minutes)) <= datetime(?)
         AND (last_notification_sent IS NULL OR datetime(last_notification_sent) < datetime(due_date, printf('-%d minutes', reminder_minutes)))`
    )
    .all(userId, nowIso) as Todo[];
}

export function markNotificationSent(userId: number, todoId: number): void {
  db.prepare('UPDATE todos SET last_notification_sent = ?, updated_at = ? WHERE id = ? AND user_id = ?').run(
    toIsoNow(),
    toIsoNow(),
    todoId,
    userId
  );
}

export function buildExportPayload(userId: number): ExportPayloadV1 {
  const todos = db
    .prepare(
      `SELECT id, title, description, completed, due_date, priority, is_recurring, recurrence_pattern,
              reminder_minutes, last_notification_sent, created_at, updated_at
       FROM todos
       WHERE user_id = ?
       ORDER BY id ASC`
    )
    .all(userId) as Array<Omit<Todo, 'user_id'>>;

  const subtasks = db
    .prepare(
      `SELECT s.id, s.todo_id, s.title, s.completed, s.position, s.created_at
       FROM subtasks s
       INNER JOIN todos t ON t.id = s.todo_id
       WHERE t.user_id = ?
       ORDER BY s.id ASC`
    )
    .all(userId) as Subtask[];

  const tags = db
    .prepare(
      `SELECT id, name, color, created_at
       FROM tags
       WHERE user_id = ?
       ORDER BY id ASC`
    )
    .all(userId) as Array<Omit<Tag, 'user_id'>>;

  const todoTags = db
    .prepare(
      `SELECT tt.todo_id, tt.tag_id
       FROM todo_tags tt
       INNER JOIN todos t ON t.id = tt.todo_id
       WHERE t.user_id = ?
       ORDER BY tt.todo_id ASC, tt.tag_id ASC`
    )
    .all(userId) as TodoTag[];

  return {
    version: '1.0',
    exported_at: new Date().toISOString(),
    timezone: getSingaporeTimezone(),
    app: 'todo-app',
    data: {
      todos,
      subtasks,
      tags,
      todo_tags: todoTags,
    },
  };
}

function validatePayload(payload: ExportPayloadV1): string[] {
  const errors: string[] = [];

  if (payload.version !== '1.0') {
    errors.push('Unsupported export version. Supported versions: 1.0');
  }

  const todos = payload.data?.todos;
  const subtasks = payload.data?.subtasks;
  const tags = payload.data?.tags;
  const todoTags = payload.data?.todo_tags;

  if (!Array.isArray(todos) || !Array.isArray(subtasks) || !Array.isArray(tags) || !Array.isArray(todoTags)) {
    errors.push('Payload data arrays are missing or invalid.');
    return errors;
  }

  const todoIdSet = new Set<number>();
  const tagIdSet = new Set<number>();

  for (const todo of todos) {
    if (!todo.title || todo.title.trim().length === 0 || todo.title.length > 200) {
      errors.push('Todo title is invalid.');
    }

    if (!isValidPriority(todo.priority)) {
      errors.push('Todo priority is invalid.');
    }

    if (!isValidRecurrencePattern(todo.recurrence_pattern)) {
      errors.push('Todo recurrence pattern is invalid.');
    }

    if (todo.completed !== 0 && todo.completed !== 1) {
      errors.push('Todo completion state is invalid.');
    }

    if (todo.reminder_minutes !== null && todo.reminder_minutes !== undefined && !REMINDER_OPTIONS.has(todo.reminder_minutes)) {
      errors.push('Todo reminder value is invalid.');
    }

    todoIdSet.add(todo.id);
  }

  for (const tag of tags) {
    if (!tag.name || tag.name.trim().length === 0) {
      errors.push('Tag name is invalid.');
    }

    if (!isValidHexColor(tag.color)) {
      errors.push('Tag color must be a 6-digit hex value.');
    }

    tagIdSet.add(tag.id);
  }

  for (const subtask of subtasks) {
    if (!todoIdSet.has(subtask.todo_id)) {
      errors.push('Subtask references unknown todo_id.');
    }

    if (!subtask.title || subtask.title.trim().length === 0 || subtask.title.length > 200) {
      errors.push('Subtask title is invalid.');
    }
  }

  for (const relation of todoTags) {
    if (!todoIdSet.has(relation.todo_id)) {
      errors.push('todo_tags relation references unknown todo_id.');
    }

    if (!tagIdSet.has(relation.tag_id)) {
      errors.push('todo_tags relation references unknown tag_id.');
    }
  }

  return [...new Set(errors)];
}

export function importTodoPayload(userId: number, request: ImportRequestV1): ImportSummary {
  const mode = request.mode ?? 'merge';
  const payload = request.payload;
  const errors = validatePayload(payload);

  if (errors.length > 0) {
    throw new Error(errors[0]);
  }

  const todoIdMap = new Map<number, number>();
  const tagIdMap = new Map<number, number>();

  const deleteTodoTagsForUser = db.prepare(
    `DELETE FROM todo_tags
     WHERE todo_id IN (SELECT id FROM todos WHERE user_id = ?)`
  );
  const deleteSubtasksForUser = db.prepare(
    `DELETE FROM subtasks
     WHERE todo_id IN (SELECT id FROM todos WHERE user_id = ?)`
  );
  const deleteTodosForUser = db.prepare('DELETE FROM todos WHERE user_id = ?');
  const deleteOrphanedTagsForUser = db.prepare(
    `DELETE FROM tags
     WHERE user_id = ?
     AND id NOT IN (SELECT DISTINCT tag_id FROM todo_tags)`
  );

  const findTagByNormalizedName = db.prepare('SELECT id FROM tags WHERE user_id = ? AND lower(trim(name)) = ? LIMIT 1');
  const insertTag = db.prepare('INSERT INTO tags (user_id, name, color, created_at) VALUES (?, ?, ?, ?)');
  const insertTodo = db.prepare(
    `INSERT INTO todos (
      user_id, title, description, completed, due_date, priority, is_recurring,
      recurrence_pattern, reminder_minutes, last_notification_sent, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertSubtask = db.prepare('INSERT INTO subtasks (todo_id, title, completed, position, created_at) VALUES (?, ?, ?, ?, ?)');
  const insertTodoTag = db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)');

  const transaction = db.transaction((): ImportSummary => {
    if (mode === 'replace') {
      deleteTodoTagsForUser.run(userId);
      deleteSubtasksForUser.run(userId);
      deleteTodosForUser.run(userId);
      deleteOrphanedTagsForUser.run(userId);
    }

    let importedTodos = 0;
    let importedSubtasks = 0;
    let importedTags = 0;
    let importedRelationships = 0;
    let skippedDuplicates = 0;

    for (const tag of payload.data.tags) {
      const normalizedName = normalizeTagName(tag.name);
      const existingTag = findTagByNormalizedName.get(userId, normalizedName) as { id: number } | undefined;

      if (existingTag) {
        tagIdMap.set(tag.id, existingTag.id);
        skippedDuplicates += 1;
        continue;
      }

      const result = insertTag.run(userId, tag.name.trim(), tag.color, tag.created_at);
      const newTagId = Number(result.lastInsertRowid);
      tagIdMap.set(tag.id, newTagId);
      importedTags += 1;
    }

    for (const todo of payload.data.todos) {
      const result = insertTodo.run(
        userId,
        todo.title,
        todo.description,
        todo.completed,
        todo.due_date,
        todo.priority,
        todo.is_recurring ?? (todo.recurrence_pattern !== 'none' ? 1 : 0),
        todo.recurrence_pattern,
        todo.reminder_minutes,
        todo.last_notification_sent ?? null,
        todo.created_at,
        todo.updated_at
      );

      const newTodoId = Number(result.lastInsertRowid);
      todoIdMap.set(todo.id, newTodoId);
      importedTodos += 1;
    }

    for (const subtask of payload.data.subtasks) {
      const mappedTodoId = todoIdMap.get(subtask.todo_id);
      if (!mappedTodoId) {
        throw new Error('Import failed validation. No data was written.');
      }

      insertSubtask.run(mappedTodoId, subtask.title, subtask.completed, subtask.position, subtask.created_at);
      importedSubtasks += 1;
    }

    for (const relation of payload.data.todo_tags) {
      const mappedTodoId = todoIdMap.get(relation.todo_id);
      const mappedTagId = tagIdMap.get(relation.tag_id);

      if (!mappedTodoId || !mappedTagId) {
        throw new Error('Import failed validation. No data was written.');
      }

      insertTodoTag.run(mappedTodoId, mappedTagId);
      importedRelationships += 1;
    }

    return {
      imported_todos: importedTodos,
      imported_subtasks: importedSubtasks,
      imported_tags: importedTags,
      imported_relationships: importedRelationships,
      skipped_duplicates: skippedDuplicates,
      mode,
    };
  });

  return transaction();
}
