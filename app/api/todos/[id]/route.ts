import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { deleteTodo, getTodoDetailsById, updateTodo } from '@/lib/db';

function parseId(id: string): number | null {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await context.params;
  const todoId = parseId(id);
  if (!todoId) {
    return NextResponse.json({ error: 'Invalid todo id.' }, { status: 400 });
  }

  const todo = getTodoDetailsById(session.userId, todoId);
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found.' }, { status: 404 });
  }

  return NextResponse.json({ todo });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await context.params;
  const todoId = parseId(id);
  if (!todoId) {
    return NextResponse.json({ error: 'Invalid todo id.' }, { status: 400 });
  }

  try {
    const body = (await request.json()) as {
      title?: string;
      description?: string | null;
      due_date?: string | null;
      priority?: 'high' | 'medium' | 'low';
      completed?: boolean;
      is_recurring?: boolean;
      recurrence_pattern?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
      reminder_minutes?: number | null;
      tag_ids?: number[];
    };

    const result = updateTodo(session.userId, todoId, body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update todo.';
    const status = message.toLowerCase().includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await context.params;
  const todoId = parseId(id);
  if (!todoId) {
    return NextResponse.json({ error: 'Invalid todo id.' }, { status: 400 });
  }

  try {
    deleteTodo(session.userId, todoId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete todo.';
    const status = message.toLowerCase().includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
