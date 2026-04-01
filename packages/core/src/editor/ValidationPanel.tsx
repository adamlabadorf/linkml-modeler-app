/**
 * ValidationPanel — M6 validation results panel.
 *
 * Shows validation issues with severity badges, grouped by category.
 * "Jump" button navigates to the offending entity in the Properties panel.
 * Save is never blocked — this panel is informational/advisory.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useAppStore } from '../store/index.js';
import { collectImportedEntities } from '../io/importResolver.js';
import type { ValidationIssue, IssueSeverity } from '../validation/index.js';

// ── Severity config ───────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<IssueSeverity, string> = {
  error: '#f87171',
  warning: '#fbbf24',
  info: '#60a5fa',
};

const SEVERITY_BG: Record<IssueSeverity, string> = {
  error: '#3f1515',
  warning: '#3b2800',
  info: '#0d2140',
};

const SEVERITY_BORDER: Record<IssueSeverity, string> = {
  error: '#7f1d1d',
  warning: '#78350f',
  info: '#1e3a5f',
};

const SEVERITY_LABEL: Record<IssueSeverity, string> = {
  error: 'ERR',
  warning: 'WRN',
  info: 'INF',
};

// ── Issue row ─────────────────────────────────────────────────────────────────

function IssueRow({
  issue,
  onJump,
}: {
  issue: ValidationIssue;
  onJump: (issue: ValidationIssue) => void;
}) {
  return (
    <div
      style={{
        ...styles.issueRow,
        background: SEVERITY_BG[issue.severity],
        borderLeft: `3px solid ${SEVERITY_COLOR[issue.severity]}`,
        borderBottom: `1px solid ${SEVERITY_BORDER[issue.severity]}`,
      }}
    >
      <div style={styles.issueMain}>
        <span
          style={{
            ...styles.severityBadge,
            background: SEVERITY_COLOR[issue.severity],
          }}
        >
          {SEVERITY_LABEL[issue.severity]}
        </span>
        <span style={styles.issueMessage}>{issue.message}</span>
      </div>
      <div style={styles.issueMeta}>
        <span style={styles.issuePath}>{issue.path}</span>
        {issue.jump && (
          <button style={styles.jumpBtn} onClick={() => onJump(issue)} title="Jump to source">
            ↗ jump
          </button>
        )}
      </div>
    </div>
  );
}

// ── Summary bar ───────────────────────────────────────────────────────────────

function SummaryBar({
  issues,
  onRun,
  lastValidatedAt,
}: {
  issues: ValidationIssue[];
  onRun: () => void;
  lastValidatedAt: number | null;
}) {
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warnCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  const timeAgo = lastValidatedAt
    ? Math.round((Date.now() - lastValidatedAt) / 1000)
    : null;

  return (
    <div style={styles.summaryBar}>
      <div style={styles.summaryCounts}>
        {errorCount > 0 && (
          <span style={{ ...styles.countBadge, background: SEVERITY_COLOR.error, color: '#fff' }}>
            {errorCount} error{errorCount !== 1 ? 's' : ''}
          </span>
        )}
        {warnCount > 0 && (
          <span style={{ ...styles.countBadge, background: SEVERITY_COLOR.warning, color: '#1c1400' }}>
            {warnCount} warning{warnCount !== 1 ? 's' : ''}
          </span>
        )}
        {infoCount > 0 && (
          <span style={{ ...styles.countBadge, background: SEVERITY_COLOR.info, color: '#fff' }}>
            {infoCount} info
          </span>
        )}
        {issues.length === 0 && lastValidatedAt !== null && (
          <span style={styles.allClear}>✓ No issues</span>
        )}
        {lastValidatedAt === null && (
          <span style={styles.notRun}>Not validated yet</span>
        )}
      </div>
      <div style={styles.summaryRight}>
        {timeAgo !== null && (
          <span style={styles.timeAgo}>{timeAgo}s ago</span>
        )}
        <button style={styles.runBtn} onClick={onRun} title="Run validation">
          ▶ Validate
        </button>
      </div>
    </div>
  );
}

// ── Filter controls ───────────────────────────────────────────────────────────

type SeverityFilter = 'all' | IssueSeverity;

function FilterBar({
  active,
  onChange,
  counts,
}: {
  active: SeverityFilter;
  onChange: (f: SeverityFilter) => void;
  counts: Record<IssueSeverity, number>;
}) {
  const opts: { key: SeverityFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'error', label: `Errors (${counts.error})` },
    { key: 'warning', label: `Warnings (${counts.warning})` },
    { key: 'info', label: `Info (${counts.info})` },
  ];

  return (
    <div style={styles.filterBar}>
      {opts.map((o) => (
        <button
          key={o.key}
          style={{
            ...styles.filterBtn,
            ...(active === o.key ? styles.filterBtnActive : {}),
          }}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function ValidationPanel() {
  const validationPanelOpen = useAppStore((s) => s.validationPanelOpen);
  const setValidationPanelOpen = useAppStore((s) => s.setValidationPanelOpen);
  const validationIssues = useAppStore((s) => s.validationIssues);
  const lastValidatedAt = useAppStore((s) => s.lastValidatedAt);
  const runValidation = useAppStore((s) => s.runValidation);
  const setActiveEntity = useAppStore((s) => s.setActiveEntity);
  const activeSchema = useAppStore((s) => s.getActiveSchema());
  const activeProject = useAppStore((s) => s.activeProject);

  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');

  const handleRun = useCallback(() => {
    if (!activeSchema) return;
    const imported = activeProject
      ? collectImportedEntities(activeSchema, activeProject.schemas)
      : [];
    const externalNames = {
      classes: new Set(imported.filter((e) => e.type === 'class').map((e) => e.name)),
      enums: new Set(imported.filter((e) => e.type === 'enum').map((e) => e.name)),
    };
    runValidation(activeSchema.schema, externalNames);
  }, [activeSchema, activeProject, runValidation]);

  const handleJump = useCallback(
    (issue: ValidationIssue) => {
      if (!issue.jump) return;
      if (issue.jump.type === 'class') {
        setActiveEntity({ type: 'class', className: issue.jump.className });
      } else if (issue.jump.type === 'enum') {
        setActiveEntity({ type: 'enum', enumName: issue.jump.enumName });
      } else {
        setActiveEntity(null);
      }
    },
    [setActiveEntity]
  );

  const counts = useMemo(
    () => ({
      error: validationIssues.filter((i) => i.severity === 'error').length,
      warning: validationIssues.filter((i) => i.severity === 'warning').length,
      info: validationIssues.filter((i) => i.severity === 'info').length,
    }),
    [validationIssues]
  );

  const filtered = useMemo(
    () =>
      severityFilter === 'all'
        ? validationIssues
        : validationIssues.filter((i) => i.severity === severityFilter),
    [validationIssues, severityFilter]
  );

  if (!validationPanelOpen) {
    return (
      <div style={styles.collapsedBar} onClick={() => setValidationPanelOpen(true)}>
        <span style={styles.collapsedLabel}>Validation</span>
        {counts.error > 0 && (
          <span style={{ ...styles.collapsedBadge, background: SEVERITY_COLOR.error }}>
            {counts.error}
          </span>
        )}
        {counts.error === 0 && counts.warning > 0 && (
          <span style={{ ...styles.collapsedBadge, background: SEVERITY_COLOR.warning, color: '#1c1400' }}>
            {counts.warning}
          </span>
        )}
      </div>
    );
  }

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.panelHeader}>
        <span style={styles.panelTitle}>Validation</span>
        <button
          style={styles.closeBtn}
          onClick={() => setValidationPanelOpen(false)}
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* Non-blocking notice */}
      <div style={styles.notice}>
        Errors and warnings are informational — save is never blocked.
      </div>

      {/* Summary + run button */}
      <SummaryBar
        issues={validationIssues}
        onRun={handleRun}
        lastValidatedAt={lastValidatedAt}
      />

      {/* Filters */}
      {validationIssues.length > 0 && (
        <FilterBar active={severityFilter} onChange={setSeverityFilter} counts={counts} />
      )}

      {/* Issues list */}
      <div style={styles.issuesList}>
        {filtered.length === 0 && lastValidatedAt !== null ? (
          <div style={styles.emptyList}>
            {severityFilter === 'all'
              ? 'No issues found.'
              : `No ${severityFilter} issues.`}
          </div>
        ) : filtered.length === 0 ? (
          <div style={styles.emptyList}>
            Click "Validate" to run the validation engine.
          </div>
        ) : (
          filtered.map((issue) => (
            <IssueRow key={issue.id} issue={issue} onJump={handleJump} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    background: '#0a1628',
    borderTop: '1px solid #1e293b',
    height: 260,
    flexShrink: 0,
    overflow: 'hidden',
  },
  collapsedBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 12px',
    background: '#080f1a',
    borderTop: '1px solid #1e293b',
    cursor: 'pointer',
    flexShrink: 0,
    userSelect: 'none',
  },
  collapsedLabel: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#475569',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  collapsedBadge: {
    borderRadius: 10,
    padding: '0 5px',
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: 700,
    color: '#fff',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '5px 12px',
    borderBottom: '1px solid #1e293b',
    flexShrink: 0,
    background: '#080f1a',
  },
  panelTitle: {
    fontWeight: 700,
    fontSize: 10,
    color: '#94a3b8',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#475569',
    cursor: 'pointer',
    fontSize: 12,
    padding: '0 2px',
    lineHeight: 1,
  },
  notice: {
    padding: '4px 12px',
    fontSize: 10,
    color: '#334155',
    fontFamily: 'monospace',
    fontStyle: 'italic',
    borderBottom: '1px solid #1e293b',
    flexShrink: 0,
  },
  summaryBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '5px 12px',
    borderBottom: '1px solid #1e293b',
    flexShrink: 0,
    background: '#0c1624',
  },
  summaryCounts: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  countBadge: {
    borderRadius: 10,
    padding: '1px 7px',
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: 700,
  },
  allClear: {
    fontSize: 11,
    color: '#4ade80',
    fontFamily: 'monospace',
    fontWeight: 600,
  },
  notRun: {
    fontSize: 11,
    color: '#475569',
    fontFamily: 'monospace',
    fontStyle: 'italic',
  },
  summaryRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  timeAgo: {
    fontSize: 10,
    color: '#334155',
    fontFamily: 'monospace',
  },
  runBtn: {
    background: '#1d4ed8',
    border: '1px solid #2563eb',
    color: '#fff',
    borderRadius: 4,
    padding: '3px 10px',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontWeight: 600,
  },
  filterBar: {
    display: 'flex',
    gap: 0,
    borderBottom: '1px solid #1e293b',
    flexShrink: 0,
  },
  filterBtn: {
    background: 'transparent',
    border: 'none',
    borderRight: '1px solid #1e293b',
    color: '#64748b',
    padding: '4px 10px',
    fontSize: 10,
    fontFamily: 'monospace',
    cursor: 'pointer',
  },
  filterBtnActive: {
    background: '#172033',
    color: '#93c5fd',
    fontWeight: 700,
  },
  issuesList: {
    flex: 1,
    overflowY: 'auto',
  },
  issueRow: {
    padding: '5px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  issueMain: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  severityBadge: {
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: 700,
    borderRadius: 3,
    padding: '1px 4px',
    color: '#fff',
    flexShrink: 0,
  },
  issueMessage: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#e2e8f0',
    flex: 1,
  },
  issueMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 24,
  },
  issuePath: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#475569',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  jumpBtn: {
    background: 'transparent',
    border: '1px solid #334155',
    color: '#60a5fa',
    borderRadius: 3,
    padding: '1px 6px',
    fontSize: 10,
    cursor: 'pointer',
    fontFamily: 'monospace',
    flexShrink: 0,
  },
  emptyList: {
    padding: '16px 12px',
    fontSize: 12,
    color: '#475569',
    fontFamily: 'monospace',
    fontStyle: 'italic',
    textAlign: 'center',
  },
};
