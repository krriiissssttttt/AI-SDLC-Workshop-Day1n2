'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { getSingaporeNow } from '@/lib/timezone';
import type { Priority, RecurrencePattern, Tag, Template, TodoDetails } from '@/lib/db';

type ImportMode = 'merge' | 'replace';

type TodoFormState = {
  title: string;
  description: string;
  due_date: string;
  priority: Priority;
  recurrence_pattern: RecurrencePattern;
  reminder_minutes: '' | '15' | '30' | '60' | '120' | '1440' | '2880' | '10080';
  tag_ids: number[];
};

const EMPTY_FORM: TodoFormState = {
  title: '',
  description: '',
  due_date: '',
  priority: 'medium',
  recurrence_pattern: 'none',
  reminder_minutes: '',
  tag_ids: [],
};

const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};
const REMINDER_VALUES = ['15', '30', '60', '120', '1440', '2880', '10080'] as const;

function toInputDateTime(value: string | null): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function toApiDateTime(value: string): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function priorityBadge(priority: Priority): string {
  if (priority === 'high') return 'badge badge-high';
  if (priority === 'medium') return 'badge badge-medium';
  return 'badge badge-low';
}

export default function HomePage() {
  const [todos, setTodos] = useState<TodoDetails[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Ready');
  const [mode, setMode] = useState<ImportMode>('merge');

  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const [selectedTag, setSelectedTag] = useState<number | null>(null);

  const [form, setForm] = useState<TodoFormState>(EMPTY_FORM);
  const [editingTodo, setEditingTodo] = useState<TodoDetails | null>(null);
  const [subtaskDrafts, setSubtaskDrafts] = useState<Record<number, string>>({});

  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#64748b');

  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');

  const loadAll = useCallback(async () => {
    setLoading(true);

    try {
      const [todosRes, tagsRes, templatesRes] = await Promise.all([
        fetch('/api/todos', { credentials: 'include' }),
        fetch('/api/tags', { credentials: 'include' }),
        fetch('/api/templates', { credentials: 'include' }),
      ]);

      if ([todosRes, tagsRes, templatesRes].some((res) => res.status === 401)) {
        window.location.href = '/login';
        return;
      }

      const [todosData, tagsData, templatesData] = await Promise.all([todosRes.json(), tagsRes.json(), templatesRes.json()]);

      setTodos(todosData.todos ?? []);
      setTags(tagsData.tags ?? []);
      setTemplates(templatesData.templates ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useNotifications(true, () => {
    void loadAll();
  });

  const requestNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setStatus('Notifications are not supported in this browser.');
      return;
    }

    const result = await Notification.requestPermission();
    setStatus(result === 'granted' ? 'Notifications enabled.' : 'Notification permission denied.');
  };

  const filteredTodos = useMemo(() => {
    const q = search.trim().toLowerCase();

    return todos.filter((todo) => {
      if (priorityFilter !== 'all' && todo.priority !== priorityFilter) {
        return false;
      }

      if (selectedTag !== null && !todo.tags.some((tag) => tag.id === selectedTag)) {
        return false;
      }

      if (!q) {
        return true;
      }

      const titleMatch = todo.title.toLowerCase().includes(q);
      const tagMatch = todo.tags.some((tag) => tag.name.toLowerCase().includes(q));
      return titleMatch || tagMatch;
    });
  }, [todos, search, priorityFilter, selectedTag]);

  const sortedTodos = useMemo(() => {
    return [...filteredTodos].sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed - b.completed;
      }

      if (PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority]) {
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      }

      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  }, [filteredTodos]);

  const now = getSingaporeNow();

  const overdue = sortedTodos.filter(
    (todo) => todo.completed === 0 && todo.due_date !== null && new Date(todo.due_date).getTime() < now.getTime()
  );
  const active = sortedTodos.filter(
    (todo) => todo.completed === 0 && (todo.due_date === null || new Date(todo.due_date).getTime() >= now.getTime())
  );
  const completed = sortedTodos.filter((todo) => todo.completed === 1);

  const resetForm = () => {
    setEditingTodo(null);
    setForm(EMPTY_FORM);
  };

  const submitTodo = async () => {
    if (!form.title.trim()) {
      setStatus('Title is required.');
      return;
    }

    const payload = {
      title: form.title,
      description: form.description || null,
      due_date: toApiDateTime(form.due_date),
      priority: form.priority,
      is_recurring: form.recurrence_pattern !== 'none',
      recurrence_pattern: form.recurrence_pattern,
      reminder_minutes: form.reminder_minutes ? Number(form.reminder_minutes) : null,
      tag_ids: form.tag_ids,
    };

    const targetUrl = editingTodo ? `/api/todos/${editingTodo.id}` : '/api/todos';
    const method = editingTodo ? 'PUT' : 'POST';

    const response = await fetch(targetUrl, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      setStatus(result.error ?? 'Failed to save todo.');
      return;
    }

    setStatus(editingTodo ? 'Todo updated.' : 'Todo created.');
    resetForm();
    await loadAll();
  };

  const toggleTodo = async (todo: TodoDetails) => {
    const response = await fetch(`/api/todos/${todo.id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: todo.completed === 0 }),
    });

    if (!response.ok) {
      const result = await response.json();
      setStatus(result.error ?? 'Failed to update todo.');
      return;
    }

    await loadAll();
  };

  const removeTodo = async (todoId: number) => {
    const response = await fetch(`/api/todos/${todoId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const result = await response.json();
      setStatus(result.error ?? 'Failed to delete todo.');
      return;
    }

    setStatus('Todo deleted.');
    await loadAll();
  };

  const addSubtask = async (todoId: number) => {
    const title = (subtaskDrafts[todoId] ?? '').trim();
    if (!title) {
      return;
    }

    const response = await fetch(`/api/todos/${todoId}/subtasks`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      const result = await response.json();
      setStatus(result.error ?? 'Failed to create subtask.');
      return;
    }

    setSubtaskDrafts((current) => ({ ...current, [todoId]: '' }));
    await loadAll();
  };

  const updateSubtask = async (subtaskId: number, completedValue: boolean) => {
    const response = await fetch(`/api/subtasks/${subtaskId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: completedValue }),
    });

    if (!response.ok) {
      const result = await response.json();
      setStatus(result.error ?? 'Failed to update subtask.');
      return;
    }

    await loadAll();
  };

  const removeSubtask = async (subtaskId: number) => {
    const response = await fetch(`/api/subtasks/${subtaskId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const result = await response.json();
      setStatus(result.error ?? 'Failed to delete subtask.');
      return;
    }

    await loadAll();
  };

  const createTagAction = async () => {
    const response = await fetch('/api/tags', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTagName, color: newTagColor }),
    });

    const result = await response.json();
    if (!response.ok) {
      setStatus(result.error ?? 'Failed to create tag.');
      return;
    }

    setNewTagName('');
    setNewTagColor('#64748b');
    await loadAll();
  };

  const deleteTagAction = async (tagId: number) => {
    const response = await fetch(`/api/tags/${tagId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const result = await response.json();
      setStatus(result.error ?? 'Failed to delete tag.');
      return;
    }

    if (selectedTag === tagId) {
      setSelectedTag(null);
    }

    await loadAll();
  };

  const saveTemplate = async () => {
    if (!editingTodo) {
      setStatus('Select a todo to save as template.');
      return;
    }

    if (!templateName.trim()) {
      setStatus('Template name is required.');
      return;
    }

    const response = await fetch('/api/templates', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: templateName,
        category: templateCategory || null,
        title: editingTodo.title,
        default_description: editingTodo.description,
        priority: editingTodo.priority,
        is_recurring: editingTodo.is_recurring === 1,
        recurrence_pattern: editingTodo.recurrence_pattern,
        reminder_minutes: editingTodo.reminder_minutes,
        due_date_offset_days: null,
        subtasks: editingTodo.subtasks.map((subtask, index) => ({ title: subtask.title, position: subtask.position ?? index })),
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      setStatus(result.error ?? 'Failed to save template.');
      return;
    }

    setTemplateName('');
    setTemplateCategory('');
    setStatus('Template saved.');
    await loadAll();
  };

  const useTemplateAction = async () => {
    if (!selectedTemplateId) {
      return;
    }

    const response = await fetch(`/api/templates/${selectedTemplateId}/use`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const result = await response.json();
    if (!response.ok) {
      setStatus(result.error ?? 'Failed to use template.');
      return;
    }

    setStatus('Todo created from template.');
    await loadAll();
  };

  const exportData = async () => {
    const response = await fetch('/api/todos/export', {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      setStatus('Export failed.');
      return;
    }

    const data = await response.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `todo-backup-${date}.json`;
    link.click();
    URL.revokeObjectURL(url);

    setStatus('Export complete.');
  };

  const importData = async (file: File) => {
    setStatus('Importing...');

    try {
      const text = await file.text();
      const payload = JSON.parse(text);

      const response = await fetch('/api/todos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode, payload }),
      });

      const result = await response.json();
      if (!response.ok) {
        setStatus(result.error ?? 'Import failed.');
        return;
      }

      setStatus(
        `Imported ${result.imported_todos} todos, ${result.imported_subtasks} subtasks, ${result.imported_tags} tags.`
      );
      await loadAll();
    } catch {
      setStatus('Invalid JSON file.');
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });

    window.location.href = '/login';
  };

  const setEditing = (todo: TodoDetails) => {
    const reminderValue = todo.reminder_minutes !== null ? String(todo.reminder_minutes) : '';
    const normalizedReminder = REMINDER_VALUES.includes(reminderValue as (typeof REMINDER_VALUES)[number])
      ? (reminderValue as TodoFormState['reminder_minutes'])
      : '';

    setEditingTodo(todo);
    setForm({
      title: todo.title,
      description: todo.description ?? '',
      due_date: toInputDateTime(todo.due_date),
      priority: todo.priority,
      recurrence_pattern: todo.recurrence_pattern,
      reminder_minutes: normalizedReminder,
      tag_ids: todo.tags.map((tag) => tag.id),
    });
  };

  const clearFilters = () => {
    setSearch('');
    setPriorityFilter('all');
    setSelectedTag(null);
  };

  const renderSection = (title: string, sectionTodos: TodoDetails[]) => (
    <section className="card" key={title}>
      <h2>{title} ({sectionTodos.length})</h2>
      {sectionTodos.length === 0 ? <p className="muted">No todos.</p> : null}
      {sectionTodos.map((todo) => (
        <article key={todo.id} className="todo-item">
          <div className="row between">
            <label className="row" style={{ gap: 8 }}>
              <input type="checkbox" checked={todo.completed === 1} onChange={() => void toggleTodo(todo)} />
              <strong>{todo.title}</strong>
            </label>
            <div className="row" style={{ gap: 8 }}>
              <span className={priorityBadge(todo.priority)}>{todo.priority}</span>
              {todo.recurrence_pattern !== 'none' ? <span className="badge">🔄 {todo.recurrence_pattern}</span> : null}
              {todo.reminder_minutes !== null ? <span className="badge">🔔 {todo.reminder_minutes}m</span> : null}
            </div>
          </div>

          {todo.description ? <p>{todo.description}</p> : null}
          {todo.due_date ? <p className="muted">Due: {new Date(todo.due_date).toLocaleString('en-SG')}</p> : null}

          <div className="row wrap" style={{ gap: 8 }}>
            {todo.tags.map((tag) => (
              <button
                key={tag.id}
                className="tag-pill"
                style={{ backgroundColor: tag.color }}
                onClick={() => setSelectedTag(tag.id)}
              >
                {tag.name}
              </button>
            ))}
          </div>

          <div className="subtasks">
            <p className="muted">
              Progress: {todo.progress.completed}/{todo.progress.total} ({todo.progress.percentage}%)
            </p>
            <progress value={todo.progress.completed} max={Math.max(todo.progress.total, 1)} />

            {todo.subtasks.map((subtask) => (
              <div className="row between" key={subtask.id}>
                <label className="row" style={{ gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={subtask.completed === 1}
                    onChange={() => void updateSubtask(subtask.id, subtask.completed === 0)}
                  />
                  <span>{subtask.title}</span>
                </label>
                <button onClick={() => void removeSubtask(subtask.id)}>Delete</button>
              </div>
            ))}

            <div className="row" style={{ gap: 8 }}>
              <input
                placeholder="New subtask"
                value={subtaskDrafts[todo.id] ?? ''}
                onChange={(event) => setSubtaskDrafts((current) => ({ ...current, [todo.id]: event.target.value }))}
              />
              <button onClick={() => void addSubtask(todo.id)}>Add Subtask</button>
            </div>
          </div>

          <div className="row" style={{ gap: 8 }}>
            <button onClick={() => setEditing(todo)}>Edit</button>
            <button onClick={() => void removeTodo(todo.id)}>Delete</button>
          </div>
        </article>
      ))}
    </section>
  );

  return (
    <main className="container">
      <header className="card">
        <div className="row between wrap">
          <h1>Todo App</h1>
          <div className="row wrap" style={{ gap: 8 }}>
            <Link href="/calendar">Calendar</Link>
            <button onClick={() => void requestNotifications()}>Enable Notifications</button>
            <button onClick={() => void logout()}>Logout</button>
          </div>
        </div>

        <p className="muted">Status: {status}</p>
      </header>

      <section className="card">
        <h2>{editingTodo ? 'Edit Todo' : 'Create Todo'}</h2>

        <div className="grid two">
          <label>
            Title
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
          </label>

          <label>
            Priority
            <select
              value={form.priority}
              onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as Priority }))}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>

          <label>
            Due Date
            <input
              type="datetime-local"
              value={form.due_date}
              onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))}
            />
          </label>

          <label>
            Recurrence
            <select
              value={form.recurrence_pattern}
              onChange={(event) =>
                setForm((current) => ({ ...current, recurrence_pattern: event.target.value as RecurrencePattern }))
              }
            >
              <option value="none">None</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>

          <label>
            Reminder
            <select
              value={form.reminder_minutes}
              onChange={(event) =>
                setForm((current) => ({ ...current, reminder_minutes: event.target.value as TodoFormState['reminder_minutes'] }))
              }
              disabled={!form.due_date}
            >
              <option value="">None</option>
              <option value="15">15 minutes before</option>
              <option value="30">30 minutes before</option>
              <option value="60">1 hour before</option>
              <option value="120">2 hours before</option>
              <option value="1440">1 day before</option>
              <option value="2880">2 days before</option>
              <option value="10080">1 week before</option>
            </select>
          </label>

          <label>
            Tags
            <select
              multiple
              value={form.tag_ids.map(String)}
              onChange={(event) => {
                const selected = Array.from(event.target.selectedOptions).map((option) => Number(option.value));
                setForm((current) => ({ ...current, tag_ids: selected }));
              }}
            >
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Description
          <textarea
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          />
        </label>

        <div className="row" style={{ gap: 8 }}>
          <button onClick={() => void submitTodo()}>{editingTodo ? 'Update Todo' : 'Create Todo'}</button>
          {editingTodo ? <button onClick={resetForm}>Cancel Edit</button> : null}
        </div>
      </section>

      <section className="card">
        <h2>Search & Filters</h2>
        <div className="grid three">
          <input placeholder="Search by title or tag" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as 'all' | Priority)}>
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button onClick={clearFilters}>Clear Filters</button>
        </div>

        {selectedTag !== null ? (
          <p>
            Filtering by tag: <strong>{tags.find((tag) => tag.id === selectedTag)?.name ?? selectedTag}</strong>{' '}
            <button onClick={() => setSelectedTag(null)}>clear</button>
          </p>
        ) : null}
      </section>

      {loading ? <p>Loading...</p> : null}

      {renderSection('Overdue', overdue)}
      {renderSection('Active', active)}
      {renderSection('Completed', completed)}

      <section className="card">
        <h2>Tag Management</h2>
        <div className="row wrap" style={{ gap: 8 }}>
          <input placeholder="Tag name" value={newTagName} onChange={(event) => setNewTagName(event.target.value)} />
          <input type="color" value={newTagColor} onChange={(event) => setNewTagColor(event.target.value)} />
          <button onClick={() => void createTagAction()}>Create Tag</button>
        </div>

        <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
          {tags.map((tag) => (
            <span key={tag.id} className="tag-row">
              <span className="tag-pill" style={{ backgroundColor: tag.color }}>
                {tag.name}
              </span>
              <button onClick={() => void deleteTagAction(tag.id)}>Delete</button>
            </span>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Templates</h2>

        <div className="grid three">
          <input placeholder="Template name" value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
          <input placeholder="Category" value={templateCategory} onChange={(event) => setTemplateCategory(event.target.value)} />
          <button onClick={() => void saveTemplate()}>Save Current Edit as Template</button>
        </div>

        <div className="grid three" style={{ marginTop: 12 }}>
          <select
            value={selectedTemplateId}
            onChange={(event) => setSelectedTemplateId(event.target.value ? Number(event.target.value) : '')}
          >
            <option value="">Select template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} {template.category ? `(${template.category})` : ''}
              </option>
            ))}
          </select>
          <button onClick={() => void useTemplateAction()} disabled={!selectedTemplateId}>
            Use Template
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Export / Import</h2>

        <div className="row wrap" style={{ gap: 8 }}>
          <button onClick={() => void exportData()}>Export Todos</button>

          <select value={mode} onChange={(event) => setMode(event.target.value as ImportMode)}>
            <option value="merge">Merge</option>
            <option value="replace">Replace</option>
          </select>

          <label className="file-label">
            Import JSON
            <input
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void importData(file);
                }
              }}
            />
          </label>
        </div>
      </section>
    </main>
  );
}
