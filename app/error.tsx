'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="container status-page">
      <h1 className="status-page-title">Something went wrong</h1>
      <p className="muted status-page-text">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <button type="button" onClick={() => reset()}>
        Try again
      </button>
    </main>
  );
}
