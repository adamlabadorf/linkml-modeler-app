import React from 'react';
import { X } from 'lucide-react';

const DISMISS_KEY = 'linkml-editor-demo-banner-dismissed-v1';

export const IS_GITHUB_PAGES =
  typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io');

export function DemoBanner() {
  const [dismissed, setDismissed] = React.useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === 'true';
    } catch {
      return false;
    }
  });

  if (!IS_GITHUB_PAGES || dismissed) return null;

  function handleDismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      // storage unavailable — still dismiss for this session
    }
    setDismissed(true);
  }

  return (
    <div style={styles.banner} role="status" aria-live="polite">
      <span style={styles.text}>
        This is a live demo. Projects are stored in your browser and may be cleared. For
        persistent storage, run locally or sign in with GitHub.
      </span>
      <button style={styles.dismiss} onClick={handleDismiss} aria-label="Dismiss demo banner">
        <X size={14} />
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '7px 16px',
    background: 'var(--color-state-info-bg)',
    borderBottom: '1px solid var(--color-state-info-border)',
    color: 'var(--color-state-info-fg)',
    fontSize: 12,
    flexShrink: 0,
  },
  text: {
    flex: 1,
  },
  dismiss: {
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    padding: '2px 4px',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    opacity: 0.8,
    flexShrink: 0,
  },
};
