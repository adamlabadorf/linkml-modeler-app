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
    description: 'A demo schema for M3 canvas testing',
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

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const setProject = useAppStore((s) => s.setProject);
  const activeProject = useAppStore((s) => s.activeProject);

  // Seed demo project on first render
  React.useEffect(() => {
    if (!activeProject) {
      setProject(makeDemoProject());
    }
  }, [activeProject, setProject]);

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <span style={styles.logo}>⬡ LinkML Visual Schema Editor</span>
        <span style={styles.subtitle}>M3 — Canvas Rendering &amp; Auto-Layout</span>
      </header>
      <main style={styles.main}>
        <SchemaCanvas />
      </main>
      <footer style={styles.footer}>
        Double-click a node to collapse/expand · Drag to reposition · Scroll to zoom · ⬡ Auto Layout button top-right
      </footer>
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
  logo: {
    fontWeight: 700,
    fontSize: 15,
    color: '#60a5fa',
  },
  subtitle: {
    fontSize: 12,
    color: '#475569',
  },
  main: {
    flex: 1,
    overflow: 'hidden',
  },
  footer: {
    padding: '5px 16px',
    borderTop: '1px solid #1e293b',
    fontSize: 11,
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
