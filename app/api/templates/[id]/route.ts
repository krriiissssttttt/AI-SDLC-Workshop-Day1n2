import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { deleteTemplate, updateTemplate } from '@/lib/db';

function parseId(id: string): number | null {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await context.params;
  const templateId = parseId(id);
  if (!templateId) {
    return NextResponse.json({ error: 'Invalid template id.' }, { status: 400 });
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

    const template = updateTemplate(session.userId, templateId, body);
    return NextResponse.json({ template });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update template.';
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
  const templateId = parseId(id);
  if (!templateId) {
    return NextResponse.json({ error: 'Invalid template id.' }, { status: 400 });
  }

  try {
    deleteTemplate(session.userId, templateId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete template.';
    const status = message.toLowerCase().includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
