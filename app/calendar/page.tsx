'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Holiday, TodoDetails } from '@/lib/db';

function toMonthString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getMonthBounds(month: string): { start: string; end: string } {
  const [year, monthPart] = month.split('-').map(Number);
  const start = new Date(year, monthPart - 1, 1);
  const end = new Date(year, monthPart, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export default function CalendarPage() {
  const today = new Date();
  const [month, setMonth] = useState(toMonthString(today));
  const [todos, setTodos] = useState<TodoDetails[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const existing = params.get('month');
    if (existing && /^\d{4}-\d{2}$/.test(existing)) {
      setMonth(existing);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      const bounds = getMonthBounds(month);
      const [todosRes, holidaysRes] = await Promise.all([
        fetch('/api/todos', { credentials: 'include' }),
        fetch(`/api/holidays?start=${bounds.start}&end=${bounds.end}`, { credentials: 'include' }),
      ]);

      if (todosRes.status === 401 || holidaysRes.status === 401) {
        window.location.href = '/login';
        return;
      }

      const todosData = await todosRes.json();
      const holidaysData = await holidaysRes.json();
      setTodos(todosData.todos ?? []);
      setHolidays(holidaysData.holidays ?? []);
    };

    void load();

    const params = new URLSearchParams(window.location.search);
    params.set('month', month);
    window.history.replaceState({}, '', `/calendar?${params.toString()}`);
  }, [month]);

  const calendarDays = useMemo(() => {
    const [year, monthPart] = month.split('-').map(Number);
    const firstDay = new Date(year, monthPart - 1, 1);
    const lastDay = new Date(year, monthPart, 0);

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    const days: Date[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [month]);

  const holidayMap = useMemo(() => {
    const map = new Map<string, Holiday>();
    for (const holiday of holidays) {
      map.set(holiday.date, holiday);
    }
    return map;
  }, [holidays]);

  const todosByDay = useMemo(() => {
    const map = new Map<string, TodoDetails[]>();
    for (const todo of todos) {
      if (!todo.due_date) continue;
      const key = new Date(todo.due_date).toISOString().slice(0, 10);
      const existing = map.get(key) ?? [];
      existing.push(todo);
      map.set(key, existing);
    }
    return map;
  }, [todos]);

  const selectedTodos = selectedDay ? todosByDay.get(selectedDay) ?? [] : [];

  const shiftMonth = (delta: number) => {
    const [year, monthPart] = month.split('-').map(Number);
    const date = new Date(year, monthPart - 1 + delta, 1);
    setMonth(toMonthString(date));
  };

  const toggleComplete = async (todo: TodoDetails) => {
    await fetch(`/api/todos/${todo.id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: todo.completed === 0 }),
    });

    const todosRes = await fetch('/api/todos', { credentials: 'include' });
    const todosData = await todosRes.json();
    setTodos(todosData.todos ?? []);
  };

  return (
    <main className="container">
      <section className="card">
        <div className="row between wrap">
          <h1>Calendar View</h1>
          <Link href="/">Back to Todos</Link>
        </div>

        <div className="row" style={{ gap: 8 }}>
          <button onClick={() => shiftMonth(-1)}>Previous</button>
          <button onClick={() => setMonth(toMonthString(new Date()))}>Today</button>
          <button onClick={() => shiftMonth(1)}>Next</button>
          <strong>{month}</strong>
        </div>
      </section>

      <section className="card">
        <div className="calendar-grid calendar-header">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="calendar-cell calendar-head-cell">
              {day}
            </div>
          ))}
        </div>

        <div className="calendar-grid">
          {calendarDays.map((day) => {
            const key = day.toISOString().slice(0, 10);
            const isCurrentMonth = key.startsWith(month);
            const isToday = key === new Date().toISOString().slice(0, 10);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            const holiday = holidayMap.get(key);
            const dayTodos = todosByDay.get(key) ?? [];

            return (
              <button
                key={key}
                className={`calendar-cell ${isCurrentMonth ? '' : 'calendar-muted'} ${isToday ? 'calendar-today' : ''} ${
                  isWeekend ? 'calendar-weekend' : ''
                } ${holiday ? 'calendar-holiday' : ''}`}
                onClick={() => setSelectedDay(key)}
              >
                <div className="row between">
                  <span>{day.getDate()}</span>
                  {dayTodos.length > 0 ? <span className="badge">{dayTodos.length}</span> : null}
                </div>
                {holiday ? <small>{holiday.name}</small> : null}
              </button>
            );
          })}
        </div>
      </section>

      {selectedDay ? (
        <section className="card">
          <div className="row between">
            <h2>Todos on {selectedDay}</h2>
            <button onClick={() => setSelectedDay(null)}>Close</button>
          </div>

          {selectedTodos.length === 0 ? <p className="muted">No todos for this day.</p> : null}

          {selectedTodos.map((todo) => (
            <article className="todo-item" key={todo.id}>
              <div className="row between">
                <strong>{todo.title}</strong>
                <button onClick={() => void toggleComplete(todo)}>{todo.completed === 1 ? 'Mark Active' : 'Complete'}</button>
              </div>
              {todo.description ? <p>{todo.description}</p> : null}
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}
