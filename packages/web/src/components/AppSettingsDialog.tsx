/**
 * AppSettingsDialog — app preferences panel.
 *
 * Currently surfaces:
 *   - GitHub projects folder (Electron only) — where repos are cloned
 *
 * Per §7 of the feature spec.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { usePlatform, useAppStore } from '@linkml-editor/core';
import { X } from 'lucide-react';

const IS_ELECTRON = typeof window !== 'undefined' && 'electronAPI' in window;

interface AppSettingsDialogProps {
  onClose(): void;
}

export function AppSettingsDialog({ onClose }: AppSettingsDialogProps) {
  const platform = usePlatform();
  const pushToast = useAppStore((s) => s.pushToast);

  const [cloneDir, setCloneDir] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load current setting
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const stored = await platform.getSetting('github-clone-dir');
      if (!cancelled) {
        if (stored) {
          setCloneDir(stored);
        } else if (IS_ELECTRON) {
          // Resolve default: ~/Documents/LinkMLProjects/
          const electronAPI = (window as unknown as { electronAPI?: { getDocumentsPath?(): Promise<string> } }).electronAPI;
          const docs = await electronAPI?.getDocumentsPath?.() ?? '';
          if (!cancelled) setCloneDir(docs ? `${docs}/LinkMLProjects` : '');
        }
        setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [platform]);

  const handleBrowse = useCallback(async () => {
    const picked = await platform.openDirectory();
    if (picked) setCloneDir(picked);
  }, [platform]);

  const handleSave = useCallback(async () => {
    if (!cloneDir.trim()) return;
    setSaving(true);
    try {
      await platform.setSetting('github-clone-dir', cloneDir.trim());
      pushToast({ message: 'Settings saved. New clones will use this folder.', severity: 'success', durationMs: 3000 });
      onClose();
    } catch (e: unknown) {
      pushToast({ message: `Failed to save settings: ${e instanceof Error ? e.message : String(e)}`, severity: 'error' });
    } finally {
      setSaving(false);
    }
  }, [platform, cloneDir, pushToast, onClose]);

  return (
    <div style={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={styles.dialog} role="dialog" aria-modal="true" aria-label="App Settings">
        <div style={styles.header}>
          <span style={styles.title}>Settings</span>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div style={styles.body}>
          {loading ? (
            <div style={styles.loading}>Loading…</div>
          ) : (
            <>
              {IS_ELECTRON ? (
                <section style={styles.section}>
                  <div style={styles.sectionTitle}>GitHub Projects</div>

                  <div style={styles.fieldLabel}>GitHub projects folder</div>
                  <div style={styles.inputRow}>
                    <input
                      style={styles.input}
                      value={cloneDir}
                      onChange={(e) => setCloneDir(e.target.value)}
                      placeholder="~/Documents/LinkMLProjects"
                      disabled={saving}
                    />
                    <button style={styles.browseBtn} onClick={handleBrowse} disabled={saving}>
                      Browse…
                    </button>
                  </div>
                  <div style={styles.hint}>
                    Where GitHub project repositories are cloned. Changing this folder will not
                    move existing clones — previously cloned projects will need to be re-cloned.
                  </div>
                </section>
              ) : (
                <div style={styles.noElectron}>
                  No additional settings available in web mode.
                </div>
              )}
            </>
          )}
        </div>

        {IS_ELECTRON && !loading && (
          <div style={styles.footer}>
            <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button style={styles.saveBtn} onClick={handleSave} disabled={saving || !cloneDir.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: 5000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: {
    background: 'var(--color-bg-canvas)',
    border: '1px solid var(--color-border-subtle)',
    borderRadius: 8,
    width: 440,
    maxWidth: '95vw',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid var(--color-border-subtle)',
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--color-fg-primary)',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-border-strong)',
    cursor: 'pointer',
    fontSize: 14,
    padding: 0,
    lineHeight: 1,
  },
  body: {
    padding: '20px 18px',
  },
  loading: {
    fontSize: 12,
    color: 'var(--color-border-strong)',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    color: 'var(--color-fg-muted)',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 12,
    color: 'var(--color-fg-secondary)',
  },
  inputRow: {
    display: 'flex',
    gap: 8,
  },
  input: {
    flex: 1,
    background: 'var(--color-bg-deep)',
    border: '1px solid var(--color-border-subtle)',
    borderRadius: 4,
    color: 'var(--color-fg-primary)',
    fontFamily: 'var(--font-family-mono)',
    fontSize: 12,
    padding: '6px 10px',
    outline: 'none',
  },
  browseBtn: {
    background: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-default)',
    color: 'var(--color-fg-primary)',
    borderRadius: 4,
    padding: '6px 12px',
    fontSize: 12,
    cursor: 'pointer',
    flexShrink: 0,
  },
  hint: {
    fontSize: 10,
    color: 'var(--color-border-strong)',
    lineHeight: 1.5,
  },
  noElectron: {
    fontSize: 12,
    color: 'var(--color-border-strong)',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '12px 18px',
    borderTop: '1px solid var(--color-border-subtle)',
  },
  cancelBtn: {
    background: 'transparent',
    border: '1px solid var(--color-border-default)',
    color: 'var(--color-fg-secondary)',
    borderRadius: 4,
    padding: '6px 14px',
    fontSize: 12,
    cursor: 'pointer',
  },
  saveBtn: {
    background: 'var(--color-accent-active)',
    border: '1px solid var(--color-border-focus)',
    color: 'var(--color-fg-on-accent)',
    borderRadius: 4,
    padding: '6px 14px',
    fontSize: 12,
    cursor: 'pointer',
  },
};
