'use client';

import { useState } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

type AuthMode = 'login' | 'register';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState('Use your passkey to register or login.');
  const [loadingMode, setLoadingMode] = useState<AuthMode | null>(null);

  const runAuthFlow = async (mode: AuthMode) => {
    const normalizedUsername = username.trim();
    if (!normalizedUsername) {
      setStatus('Please enter a username.');
      return;
    }

    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      setStatus('WebAuthn not supported in this browser.');
      return;
    }

    setLoadingMode(mode);
    setStatus(mode === 'register' ? 'Preparing registration...' : 'Preparing login...');

    try {
      const optionsResponse = await fetch(`/api/auth/${mode}-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: normalizedUsername }),
      });

      const optionsPayload = (await optionsResponse.json()) as { error?: string };
      if (!optionsResponse.ok) {
        setStatus(optionsPayload.error ?? 'Failed to initialize passkey flow.');
        return;
      }

      const passkeyResponse =
        mode === 'register'
          ? await startRegistration({ optionsJSON: optionsPayload })
          : await startAuthentication({ optionsJSON: optionsPayload });

      const verifyResponse = await fetch(`/api/auth/${mode}-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: normalizedUsername,
          response: passkeyResponse,
        }),
      });

      const verifyPayload = (await verifyResponse.json()) as { error?: string };
      if (!verifyResponse.ok) {
        setStatus(verifyPayload.error ?? 'Authentication failed.');
        return;
      }

      window.location.href = '/';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setStatus('Authentication cancelled.');
      } else {
        setStatus('Authentication failed. Please try again.');
      }
    } finally {
      setLoadingMode(null);
    }
  };

  return (
    <main className="container" style={{ maxWidth: 420, margin: '4rem auto', padding: '1rem' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Passkey Login</h1>
      <p style={{ marginBottom: '1rem', color: '#475569' }}>Use WebAuthn to register or sign in without a password.</p>

      <label htmlFor="username" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
        Username
      </label>
      <input
        id="username"
        type="text"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        autoComplete="username webauthn"
        placeholder="e.g. kris"
        style={{
          width: '100%',
          padding: '0.625rem 0.75rem',
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          marginBottom: '1rem',
        }}
      />

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={() => void runAuthFlow('register')}
          disabled={loadingMode !== null}
          style={{ flex: 1, padding: '0.625rem 0.75rem' }}
        >
          {loadingMode === 'register' ? 'Registering...' : 'Register'}
        </button>
        <button
          type="button"
          onClick={() => void runAuthFlow('login')}
          disabled={loadingMode !== null}
          style={{ flex: 1, padding: '0.625rem 0.75rem' }}
        >
          {loadingMode === 'login' ? 'Logging in...' : 'Login'}
        </button>
      </div>

      <p aria-live="polite" style={{ minHeight: 24, color: '#334155' }}>
        {status}
      </p>
    </main>
  );
}
