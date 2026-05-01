/**
 * AuthContext — React context for GitHub OAuth session state.
 *
 * Wraps GitHubAuth and provides:
 *   - current session (null = signed out)
 *   - loading state
 *   - startSignIn() — begins Device Flow and shows the modal
 *   - signOut()
 *   - Device Flow modal state (userCode, verificationUri, polling)
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePlatform } from '@linkml-editor/core';
import { GitHubAuth, type GitHubSession, type DeviceFlowHandle } from '@linkml-editor/core';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeviceFlowState {
  userCode: string;
  verificationUri: string;
  status: 'waiting' | 'polling' | 'error';
  error?: string;
  handle: DeviceFlowHandle;
}

export interface AuthContextValue {
  session: GitHubSession | null;
  loading: boolean;
  deviceFlow: DeviceFlowState | null;
  startSignIn(): Promise<void>;
  cancelSignIn(): void;
  signOut(): Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

const CLIENT_ID = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_GITHUB_CLIENT_ID ?? '';

export interface AuthProviderProps {
  children: React.ReactNode;
  /** Called after successful sign-in with the OAuth token. When provided,
   *  the caller handles platform swap — no page reload occurs. */
  onSignedIn?: (token: string) => void | Promise<void>;
  /** Called after sign-out. When provided, the caller handles platform swap. */
  onSignedOut?: () => void | Promise<void>;
}

export function AuthProvider({ children, onSignedIn, onSignedOut }: AuthProviderProps) {
  const platform = usePlatform();
  const [auth] = useState(() => new GitHubAuth(platform, CLIENT_ID));
  const [session, setSession] = useState<GitHubSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceFlow, setDeviceFlow] = useState<DeviceFlowState | null>(null);

  // On mount, check for stored session (Electron keytar; web: always null at startup)
  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      try {
        const s = await auth.getSession();
        if (!cancelled) setSession(s);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    checkSession();
    return () => { cancelled = true; };
  }, [auth]);

  const startSignIn = useCallback(async () => {
    if (!CLIENT_ID) {
      console.warn('[AuthProvider] VITE_GITHUB_CLIENT_ID is not set — sign-in unavailable');
      return;
    }
    try {
      const handle = await auth.startDeviceFlow();
      setDeviceFlow({
        userCode: handle.userCode,
        verificationUri: handle.verificationUri,
        status: 'polling',
        handle,
      });

      // Begin polling — resolves when user completes auth in browser
      const newSession = await handle.poll();
      setSession(newSession);
      setDeviceFlow(null);
      if (onSignedIn) {
        // Web path: swap platform in-place without a page reload
        await onSignedIn(newSession.token);
      } else {
        // Electron fallback: reload so bootstrap() picks up the keytar token
        window.location.reload();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // If cancelled, just close silently
      if (msg === 'Device flow cancelled') {
        setDeviceFlow(null);
        return;
      }
      setDeviceFlow((prev) =>
        prev ? { ...prev, status: 'error', error: msg } : null
      );
    }
  }, [auth, onSignedIn]);

  const cancelSignIn = useCallback(() => {
    deviceFlow?.handle.cancel();
    setDeviceFlow(null);
  }, [deviceFlow]);

  const signOut = useCallback(async () => {
    await auth.signOut();
    setSession(null);
    if (onSignedOut) {
      await onSignedOut();
    } else {
      // Electron fallback: reload to clear keytar-backed session state
      window.location.reload();
    }
  }, [auth, onSignedOut]);

  return (
    <AuthContext.Provider value={{ session, loading, deviceFlow, startSignIn, cancelSignIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
