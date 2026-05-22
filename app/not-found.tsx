export default function NotFound() {
  return (
    <main className="container" style={{ maxWidth: 640, margin: '5rem auto', textAlign: 'center' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>404 - Page Not Found</h1>
      <p className="muted" style={{ marginBottom: '1.5rem' }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <a href="/login">Go to Login</a>
    </main>
  );
}
