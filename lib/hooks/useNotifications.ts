import { useCallback, useEffect, useRef } from 'react';

export interface ReminderTodo {
  id: number;
  title: string;
}

export function useNotifications(enabled: boolean, onDelivered?: () => void) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    if (typeof window === 'undefined' || Notification.permission !== 'granted') {
      return;
    }

    const response = await fetch('/api/notifications/check', { credentials: 'include' });
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { todos?: ReminderTodo[] };
    for (const todo of data.todos ?? []) {
      void new Notification('Todo Reminder', {
        body: `"${todo.title}" is due soon.`,
      });
    }

    if ((data.todos ?? []).length > 0) {
      onDelivered?.();
    }
  }, [onDelivered]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    timerRef.current = setInterval(() => {
      void poll();
    }, 30000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [enabled, poll]);

  return { poll };
}
