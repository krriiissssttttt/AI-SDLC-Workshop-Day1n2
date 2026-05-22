import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createTodo, listTodoDetailsForUser } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const todos = listTodoDetailsForUser(session.userId);
  return NextResponse.json({ todos });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      title?: string;
      description?: string | null;
      due_date?: string | null;
      priority?: 'high' | 'medium' | 'low';
      is_recurring?: boolean;
      recurrence_pattern?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
      reminder_minutes?: number | null;
      tag_ids?: number[];
    };

    if (!body.title) {
      return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
    }

    const todo = createTodo(session.userId, {
      title: body.title,
      description: body.description,
      due_date: body.due_date,
      priority: body.priority,
      is_recurring: body.is_recurring,
      recurrence_pattern: body.recurrence_pattern,
      reminder_minutes: body.reminder_minutes,
      tag_ids: body.tag_ids,
    });

    return NextResponse.json({ todo }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create todo.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
