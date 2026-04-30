/**
 * AppSettingsDialog — app preferences panel.
 *
 * Currently surfaces:
 *   - GitHub projects folder (Electron only) — where repos are cloned
 *
 * Per §7 of the feature spec.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { usePlatform, useAppStore, Button, Dialog } from '@linkml-editor/core';

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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const stored = await platform.getSetting('github-clone-dir');
      if (!cancelled) {
        if (stored) {
          setCloneDir(stored);
        } else if (IS_ELECTRON) {
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
    <Dialog
      open
      onClose={onClose}
      title="Settings"
      size="sm"
      footer={
        IS_ELECTRON && !loading ? (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={saving}
              disabled={saving || !cloneDir.trim()}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        ) : undefined
      }
    >
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
                <Button variant="secondary" size="sm" onClick={handleBrowse} disabled={saving}>
                  Browse…
                </Button>
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
    </Dialog>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
    alignItems: 'center',
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
  hint: {
    fontSize: 10,
    color: 'var(--color-border-strong)',
    lineHeight: 1.5,
  },
  noElectron: {
    fontSize: 12,
    color: 'var(--color-border-strong)',
  },
};
