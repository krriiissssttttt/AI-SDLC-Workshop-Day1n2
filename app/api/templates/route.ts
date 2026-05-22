import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createTemplate, listTemplatesForUser } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({ templates: listTemplatesForUser(session.userId) });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      description?: string | null;
      category?: string | null;
      title?: string;
      default_description?: string | null;
      priority?: 'high' | 'medium' | 'low';
      is_recurring?: boolean;
      recurrence_pattern?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
      reminder_minutes?: number | null;
      due_date_offset_days?: number | null;
      subtasks?: Array<{ title: string; position?: number }>;
    };

    if (!body.name || !body.title) {
      return NextResponse.json({ error: 'Template name and title are required.' }, { status: 400 });
    }

    const template = createTemplate(session.userId, {
      name: body.name,
      title: body.title,
      description: body.description,
      category: body.category,
      default_description: body.default_description,
      priority: body.priority,
      is_recurring: body.is_recurring,
      recurrence_pattern: body.recurrence_pattern,
      reminder_minutes: body.reminder_minutes,
      due_date_offset_days: body.due_date_offset_days,
      subtasks: body.subtasks,
    });
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create template.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
