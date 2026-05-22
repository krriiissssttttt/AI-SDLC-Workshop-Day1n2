import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="container status-page">
      <h1 className="status-page-title">404 - Page Not Found</h1>
      <p className="muted status-page-text">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link href="/login">Go to Login</Link>
    </main>
  );
}
