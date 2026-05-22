import Database from 'better-sqlite3';
import path from 'node:path';
import { getSingaporeTimezone } from '@/lib/timezone';

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
  recurrence_pattern: RecurrencePattern;
  reminder_minutes: number | null;
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

function initializeSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      due_date TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      recurrence_pattern TEXT NOT NULL DEFAULT 'none',
      reminder_minutes INTEGER,
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
  `);
}

initializeSchema();

function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

function isValidPriority(value: string): value is Priority {
  return value === 'high' || value === 'medium' || value === 'low';
}

function isValidRecurrencePattern(value: string): value is RecurrencePattern {
  return value === 'none' || value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'yearly';
}

function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
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

  if (todos.length > 10000 || subtasks.length > 10000 || tags.length > 10000 || todoTags.length > 10000) {
    errors.push('Payload exceeds row limits.');
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

    if (
      todo.reminder_minutes !== null &&
      todo.reminder_minutes !== 15 &&
      todo.reminder_minutes !== 30 &&
      todo.reminder_minutes !== 60 &&
      todo.reminder_minutes !== 120 &&
      todo.reminder_minutes !== 1440 &&
      todo.reminder_minutes !== 2880 &&
      todo.reminder_minutes !== 10080
    ) {
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

export function createUser(username: string): number {
  const result = db
    .prepare('INSERT INTO users (username) VALUES (?)')
    .run(username.trim());

  return Number(result.lastInsertRowid);
}

export function findUserByUsername(username: string): { id: number; username: string } | null {
  const user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(username.trim()) as
    | { id: number; username: string }
    | undefined;

  return user ?? null;
}

export function buildExportPayload(userId: number): ExportPayloadV1 {
  const todos = db
    .prepare(
      `SELECT id, title, description, completed, due_date, priority, recurrence_pattern, reminder_minutes, created_at, updated_at
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
      `SELECT DISTINCT tg.id, tg.name, tg.color, tg.created_at
       FROM tags tg
       LEFT JOIN todo_tags tt ON tt.tag_id = tg.id
       LEFT JOIN todos t ON t.id = tt.todo_id
       WHERE tg.user_id = ? OR t.user_id = ?
       ORDER BY tg.id ASC`
    )
    .all(userId, userId) as Array<Omit<Tag, 'user_id'>>;

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

  const findTagByNormalizedName = db.prepare(
    `SELECT id FROM tags WHERE user_id = ? AND lower(trim(name)) = ? LIMIT 1`
  );
  const insertTag = db.prepare(
    'INSERT INTO tags (user_id, name, color, created_at) VALUES (?, ?, ?, ?)'
  );
  const insertTodo = db.prepare(
    `INSERT INTO todos (user_id, title, description, completed, due_date, priority, recurrence_pattern, reminder_minutes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertSubtask = db.prepare(
    'INSERT INTO subtasks (todo_id, title, completed, position, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  const insertTodoTag = db.prepare(
    'INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)'
  );

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
        todo.recurrence_pattern,
        todo.reminder_minutes,
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
