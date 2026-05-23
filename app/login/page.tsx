'use client';

import { useState } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';

type AuthMode = 'login' | 'register';
type ErrorResponse = { error?: string };

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

    if (!window.isSecureContext) {
      setStatus('Passkeys require a secure context. Use HTTPS or a trusted localhost origin.');
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

      const optionsPayload = (await optionsResponse.json()) as
        | ErrorResponse
        | PublicKeyCredentialCreationOptionsJSON
        | PublicKeyCredentialRequestOptionsJSON;
      if (!optionsResponse.ok) {
        setStatus((optionsPayload as ErrorResponse).error ?? 'Failed to initialize passkey flow.');
        return;
      }

      const passkeyResponse =
        mode === 'register'
          ? await startRegistration({ optionsJSON: optionsPayload as PublicKeyCredentialCreationOptionsJSON })
          : await startAuthentication({ optionsJSON: optionsPayload as PublicKeyCredentialRequestOptionsJSON });

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
      } else if (error instanceof Error && error.name === 'NotAllowedError') {
        setStatus('Passkey request was cancelled or blocked. Please try again.');
      } else {
        setStatus('Authentication failed. Please try again.');
      }
    } finally {
      setLoadingMode(null);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-card">
          <p className="auth-kicker">Passkey Access</p>
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">Register or sign in with WebAuthn passkeys for a fast, passwordless experience.</p>

          <label className="auth-label" htmlFor="username">
            Username
          </label>
          <input
            className="auth-input"
            id="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username webauthn"
            placeholder="e.g. kris"
          />

          <div className="auth-actions">
            <button
              className="auth-btn auth-btn-primary"
              type="button"
              onClick={() => void runAuthFlow('register')}
              disabled={loadingMode !== null}
            >
              {loadingMode === 'register' ? 'Registering...' : 'Register'}
            </button>
            <button
              className="auth-btn auth-btn-secondary"
              type="button"
              onClick={() => void runAuthFlow('login')}
              disabled={loadingMode !== null}
            >
              {loadingMode === 'login' ? 'Logging in...' : 'Login'}
            </button>
          </div>

          <p aria-live="polite" className="auth-status">
            {status}
          </p>
        </section>
      </div>
    </main>
  );
}
