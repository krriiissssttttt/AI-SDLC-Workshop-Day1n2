'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="container" style={{ maxWidth: 640, margin: '5rem auto', textAlign: 'center' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Something went wrong</h1>
      <p className="muted" style={{ marginBottom: '1.5rem' }}>
        {error.message || 'An unexpected error occurred.'}
      </p>
      <button type="button" onClick={() => reset()}>
        Try again
      </button>
    </main>
  );
}
