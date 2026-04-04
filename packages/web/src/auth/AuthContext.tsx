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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const platform = usePlatform();
  const [auth] = useState(() => new GitHubAuth(platform, CLIENT_ID));
  const [session, setSession] = useState<GitHubSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceFlow, setDeviceFlow] = useState<DeviceFlowState | null>(null);

  // On mount, check for stored session
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
  }, [auth]);

  const cancelSignIn = useCallback(() => {
    deviceFlow?.handle.cancel();
    setDeviceFlow(null);
  }, [deviceFlow]);

  const signOut = useCallback(async () => {
    await auth.signOut();
    // signOut() reloads — state below is never reached but included for type safety
    setSession(null);
  }, [auth]);

  return (
    <AuthContext.Provider value={{ session, loading, deviceFlow, startSignIn, cancelSignIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
