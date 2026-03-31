import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  PlatformContext,
  StubWebPlatform,
  useAppStore,
  emptySchema,
  emptyClassDefinition,
  emptyEnumDefinition,
  emptyCanvasLayout,
  serializeYaml,
  PropertiesPanel,
  SchemaSettingsDialog,
} from '@linkml-editor/core';
import { SchemaCanvas } from '@linkml-editor/core';
import type { Project } from '@linkml-editor/core';

// ── Seed demo project ─────────────────────────────────────────────────────────
function makeDemoProject(): Project {
  const namedThingClass = {
    ...emptyClassDefinition('NamedThing'),
    description: 'Anything with a name',
    abstract: true,
    attributes: {
      id: { name: 'id', range: 'string', identifier: true },
      name: { name: 'name', range: 'string' },
    },
  };

  const hasAliasesMixin = {
    ...emptyClassDefinition('HasAliases'),
    mixin: true,
    attributes: {
      aliases: { name: 'aliases', range: 'string', multivalued: true },
    },
  };

  const personClass = {
    ...emptyClassDefinition('Person'),
    description: 'A human being',
    isA: 'NamedThing',
    mixins: ['HasAliases'],
    attributes: {
      age: { name: 'age', range: 'integer' },
      employment_status: { name: 'employment_status', range: 'EmploymentStatus' },
      employer: { name: 'employer', range: 'Organization' },
    },
  };

  const organizationClass = {
    ...emptyClassDefinition('Organization'),
    description: 'A group acting as a unit',
    isA: 'NamedThing',
    attributes: {
      employees: { name: 'employees', range: 'Person', multivalued: true },
    },
  };

  const employmentEnum = {
    ...emptyEnumDefinition('EmploymentStatus'),
    permissibleValues: {
      EMPLOYED: { text: 'EMPLOYED', meaning: 'schema:employedPerson' },
      UNEMPLOYED: { text: 'UNEMPLOYED' },
      RETIRED: { text: 'RETIRED' },
    },
  };

  const schema = {
    ...emptySchema('personinfo', 'https://example.org/personinfo', 'personinfo'),
    title: 'Person Info Schema',
    description: 'A demo schema for interactive editing',
    classes: {
      NamedThing: namedThingClass,
      HasAliases: hasAliasesMixin,
      Person: personClass,
      Organization: organizationClass,
    },
    enums: {
      EmploymentStatus: employmentEnum,
    },
  };

  return {
    id: 'demo-project',
    name: 'Demo — Person Info',
    rootPath: '/',
    schemas: [
      {
        id: 'demo-schema',
        filePath: 'personinfo.yaml',
        schema,
        isDirty: false,
        canvasLayout: emptyCanvasLayout(),
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ── YAML Preview panel ────────────────────────────────────────────────────────
function YamlPreview() {
  const schema = useAppStore((s) => s.getActiveSchema());

  const yaml = React.useMemo(() => {
    if (!schema?.schema) return '';
    try {
      return serializeYaml(schema.schema);
    } catch {
      return '# serialization error';
    }
  }, [schema]);

  return (
    <div style={yamlStyles.panel}>
      <div style={yamlStyles.header}>
        <span style={yamlStyles.title}>YAML Preview</span>
        {schema?.isDirty && <span style={yamlStyles.dirty}>● unsaved</span>}
      </div>
      <pre style={yamlStyles.code}>{yaml}</pre>
    </div>
  );
}

const yamlStyles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    width: 300,
    borderLeft: '1px solid #1e293b',
    background: '#060e1a',
    flexShrink: 0,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid #1e293b',
    flexShrink: 0,
  },
  title: {
    fontWeight: 600,
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'monospace',
  },
  dirty: {
    fontSize: 11,
    color: '#f59e0b',
    fontFamily: 'monospace',
  },
  code: {
    flex: 1,
    overflowY: 'auto',
    margin: 0,
    padding: '8px 12px',
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#94a3b8',
    whiteSpace: 'pre',
    lineHeight: 1.5,
  },
};

// ── Toast display ─────────────────────────────────────────────────────────────
function ToastList() {
  const toastQueue = useAppStore((s) => s.toastQueue);
  const dismissToast = useAppStore((s) => s.dismissToast);

  return (
    <div style={toastStyles.container}>
      {toastQueue.map((t) => (
        <div key={t.id} style={{ ...toastStyles.toast, ...toastStyles[t.severity] }}>
          <span>{t.message}</span>
          <button style={toastStyles.dismiss} onClick={() => dismissToast(t.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

const toastStyles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    bottom: 32,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    zIndex: 3000,
    pointerEvents: 'none',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 14px',
    borderRadius: 6,
    fontSize: 13,
    fontFamily: 'monospace',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    pointerEvents: 'auto',
    background: '#1e293b',
    border: '1px solid #334155',
    color: '#e2e8f0',
  },
  info: { background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' },
  success: { background: '#14532d', border: '1px solid #166534', color: '#86efac' },
  warning: { background: '#451a03', border: '1px solid #78350f', color: '#fde68a' },
  error: { background: '#450a0a', border: '1px solid #7f1d1d', color: '#fca5a5' },
  dismiss: {
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    padding: 0,
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 1,
  },
};

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const setProject = useAppStore((s) => s.setProject);
  const activeProject = useAppStore((s) => s.activeProject);
  const schemaSettingsOpen = useAppStore((s) => s.schemaSettingsOpen);
  const setSchemaSettingsOpen = useAppStore((s) => s.setSchemaSettingsOpen);
  const schema = useAppStore((s) => s.getActiveSchema());
  const isDirty = useAppStore((s) => s.getIsDirty());

  React.useEffect(() => {
    if (!activeProject) {
      setProject(makeDemoProject());
    }
  }, [activeProject, setProject]);

  return (
    <div style={styles.app}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.logo}>⬡ LinkML Visual Schema Editor</span>
          <span style={styles.subtitle}>M4 — Interactive Editing</span>
        </div>
        <div style={styles.headerRight}>
          {isDirty && <span style={styles.dirtyBadge}>● unsaved changes</span>}
          <button
            style={styles.headerBtn}
            onClick={() => setSchemaSettingsOpen(true)}
            title="Schema Settings"
          >
            ⚙ Schema Settings
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div style={styles.main}>
        {/* Canvas (center) */}
        <div style={styles.canvasArea}>
          <SchemaCanvas />
        </div>

        {/* Properties panel (right) */}
        <PropertiesPanel />

        {/* YAML preview (far right) */}
        <YamlPreview />
      </div>

      {/* Status bar */}
      <footer style={styles.footer}>
        <span>
          {schema
            ? `${Object.keys(schema.schema.classes).length} class(es) · ${Object.keys(schema.schema.enums).length} enum(s)`
            : 'No schema loaded'}
        </span>
        <span>
          Click node to edit · Right-click canvas to add · Drag handle-to-handle for is_a · Del to delete · Ctrl+Z / Ctrl+Y to undo/redo
        </span>
      </footer>

      {/* Schema settings dialog */}
      {schemaSettingsOpen && (
        <SchemaSettingsDialog onClose={() => setSchemaSettingsOpen(false)} />
      )}

      {/* Toast notifications */}
      <ToastList />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#0f172a',
    color: '#e2e8f0',
    fontFamily: 'monospace',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    borderBottom: '1px solid #1e293b',
    background: '#0f172a',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    fontWeight: 700,
    fontSize: 15,
    color: '#60a5fa',
  },
  subtitle: {
    fontSize: 12,
    color: '#475569',
  },
  dirtyBadge: {
    fontSize: 11,
    color: '#f59e0b',
  },
  headerBtn: {
    background: '#1e293b',
    border: '1px solid #334155',
    color: '#94a3b8',
    borderRadius: 5,
    padding: '5px 10px',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'monospace',
  },
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  canvasArea: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 16px',
    borderTop: '1px solid #1e293b',
    fontSize: 10,
    color: '#334155',
    background: '#0f172a',
    flexShrink: 0,
  },
};

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const platform = new StubWebPlatform();
const container = document.getElementById('root')!;
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <PlatformContext.Provider value={platform}>
      <App />
    </PlatformContext.Provider>
  </React.StrictMode>
);
