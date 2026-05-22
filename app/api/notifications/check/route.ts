import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getTodosNeedingNotification, markNotificationSent } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const due = getTodosNeedingNotification(session.userId);
  for (const todo of due) {
    markNotificationSent(session.userId, todo.id);
  }

  return NextResponse.json({ todos: due });
}
