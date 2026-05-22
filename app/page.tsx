'use client';

import { useState } from 'react';

type ImportMode = 'merge' | 'replace';

export default function HomePage() {
  const [mode, setMode] = useState<ImportMode>('merge');
  const [status, setStatus] = useState('Ready');

  const exportData = async () => {
    setStatus('Exporting...');

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

      if (!response.ok) {
        const error = await response.json();
        setStatus(error.error ?? 'Import failed.');
        return;
      }

      const result = await response.json();
      setStatus(
        `Imported ${result.imported_todos} todos, ${result.imported_subtasks} subtasks, ${result.imported_tags} tags.`
      );
    } catch {
      setStatus('Invalid JSON file.');
    }
  };

  return (
    <main className="container">
      <h1>Todo App Scaffold</h1>
      <p>This is a starter shell based on the workshop README architecture.</p>

      <section style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <button onClick={exportData} style={{ padding: '8px 14px' }}>
          Export JSON
        </button>

        <select value={mode} onChange={(e) => setMode(e.target.value as ImportMode)}>
          <option value="merge">Merge</option>
          <option value="replace">Replace</option>
        </select>

        <label style={{ border: '1px solid #cbd5e1', padding: '8px 12px', cursor: 'pointer' }}>
          Import JSON
          <input
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void importData(file);
              }
            }}
          />
        </label>
      </section>

      <p>
        <strong>Status:</strong> {status}
      </p>
    </main>
  );
}
