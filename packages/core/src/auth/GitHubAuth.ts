/**
 * GitHubAuth — Device Flow OAuth for GitHub (RFC 8628).
 *
 * Uses the PlatformAPI credential storage so token persistence is
 * environment-appropriate (localStorage in web, keytar in Electron).
 *
 * No client_secret is used or needed. Only the client_id (public) is required.
 *
 * Usage:
 *   const auth = new GitHubAuth(platform, clientId);
 *   const session = await auth.getSession();
 *   const handle = await auth.startDeviceFlow();
 *   // show handle.userCode, open handle.verificationUri
 *   const session = await handle.poll();
 */
import type { PlatformAPI } from '../platform/PlatformContext.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GitHubSession {
  token: string;
  login: string;       // GitHub username
  name: string | null;
  avatarUrl: string;
}

export interface DeviceFlowHandle {
  userCode: string;         // e.g. "ABCD-1234" — display to user
  verificationUri: string;  // open in new tab (web) or shell.openExternal (Electron)
  poll(): Promise<GitHubSession>;  // resolves when auth completes
  cancel(): void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const USER_API_URL = 'https://api.github.com/user';
const SCOPE = 'repo';
const CREDENTIAL_KEY = 'github-token';

// ── GitHubAuth ────────────────────────────────────────────────────────────────

export class GitHubAuth {
  constructor(
    private readonly platform: PlatformAPI,
    private readonly clientId: string,
  ) {}

  /**
   * Returns the current session if a valid token is stored, null otherwise.
   * If the stored token is invalid/expired, it is cleared.
   */
  async getSession(): Promise<GitHubSession | null> {
    const token = await this.platform.getCredential(CREDENTIAL_KEY);
    if (!token) return null;

    try {
      const res = await fetch(USER_API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      });
      if (!res.ok) {
        await this.platform.deleteCredential(CREDENTIAL_KEY);
        return null;
      }
      const user = await res.json() as { login: string; name?: string | null; avatar_url: string };
      return {
        token,
        login: user.login,
        name: user.name ?? null,
        avatarUrl: user.avatar_url,
      };
    } catch {
      await this.platform.deleteCredential(CREDENTIAL_KEY);
      return null;
    }
  }

  /**
   * Initiates the Device Flow. Returns a handle with the user code to display
   * and a poll() method that resolves once the user completes authorization.
   */
  async startDeviceFlow(): Promise<DeviceFlowHandle> {
    const res = await fetch(DEVICE_CODE_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ client_id: this.clientId, scope: SCOPE }),
    });

    if (!res.ok) {
      throw new Error(`GitHub Device Flow initiation failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json() as {
      device_code: string;
      user_code: string;
      verification_uri: string;
      expires_in: number;
      interval: number;
    };

    const { device_code, user_code, verification_uri, expires_in, interval } = data;
    let cancelled = false;
    const platform = this.platform;
    const clientId = this.clientId;

    return {
      userCode: user_code,
      verificationUri: verification_uri,

      poll: (): Promise<GitHubSession> => {
        return new Promise((resolve, reject) => {
          const expiresAt = Date.now() + (expires_in * 1000);
          let pollIntervalMs = (interval ?? 5) * 1000;

          async function attempt() {
            if (cancelled) {
              reject(new Error('Device flow cancelled'));
              return;
            }
            if (Date.now() > expiresAt) {
              reject(new Error('Authorization timed out. Please try again.'));
              return;
            }

            try {
              const tokenRes = await fetch(ACCESS_TOKEN_URL, {
                method: 'POST',
                headers: {
                  Accept: 'application/json',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ client_id: clientId, device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }),
              });

              const tokenData = await tokenRes.json() as {
                access_token?: string;
                error?: string;
                interval?: number;
              };

              if (tokenData.access_token) {
                await platform.storeCredential(CREDENTIAL_KEY, tokenData.access_token);
                // Fetch user info to build session
                const userRes = await fetch(USER_API_URL, {
                  headers: {
                    Authorization: `Bearer ${tokenData.access_token}`,
                    Accept: 'application/vnd.github+json',
                  },
                });
                if (!userRes.ok) {
                  reject(new Error('Failed to fetch user info after authentication'));
                  return;
                }
                const user = await userRes.json() as { login: string; name?: string | null; avatar_url: string };
                resolve({
                  token: tokenData.access_token,
                  login: user.login,
                  name: user.name ?? null,
                  avatarUrl: user.avatar_url,
                });
              } else if (tokenData.error === 'authorization_pending') {
                setTimeout(attempt, pollIntervalMs);
              } else if (tokenData.error === 'slow_down') {
                pollIntervalMs = (tokenData.interval ?? (interval + 5)) * 1000;
                setTimeout(attempt, pollIntervalMs);
              } else if (tokenData.error === 'expired_token') {
                reject(new Error('Authorization timed out. Please try again.'));
              } else if (tokenData.error === 'access_denied') {
                reject(new Error('Authorization was denied.'));
              } else {
                reject(new Error(`Unexpected error: ${tokenData.error ?? 'unknown'}`));
              }
            } catch (e) {
              // Network error — retry after interval
              setTimeout(attempt, pollIntervalMs);
            }
          }

          setTimeout(attempt, pollIntervalMs);
        });
      },

      cancel: () => {
        cancelled = true;
      },
    };
  }

  /**
   * Signs out by deleting the stored credential.
   * Callers are responsible for updating the UI (e.g. swapping back to the
   * base platform). No page reload is triggered.
   */
  async signOut(): Promise<void> {
    await this.platform.deleteCredential(CREDENTIAL_KEY);
  }
}
