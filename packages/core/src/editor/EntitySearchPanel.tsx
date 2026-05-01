/**
 * EntitySearchPanel — filterable search across all entities in the project.
 *
 * Shows classes and enums from all schemas in the active project. Clicking
 * an entity switches to its schema (if necessary) and zooms the canvas to it.
 */
import React, { useMemo, useState } from 'react';
import { useAppStore } from '../store/index.js';

interface EntityRow {
  name: string;
  type: 'class' | 'enum';
  schemaId: string;
  filePath: string;
  isReadOnly: boolean;
}

export function EntitySearchPanel() {
  const activeProject = useAppStore((s) => s.activeProject);
  const activeSchemaId = useAppStore((s) => s.activeSchemaId);
  const setActiveSchema = useAppStore((s) => s.setActiveSchema);
  const setActiveEntity = useAppStore((s) => s.setActiveEntity);
  const requestFocusNode = useAppStore((s) => s.requestFocusNode);

  const [query, setQuery] = useState('');

  // Compute names referenced by the active schema (via range, is_a, mixins, union_of)
  const activeSchemaReferencedNames = useMemo(() => {
    if (!activeProject || !activeSchemaId) return new Set<string>();
    const sf = activeProject.schemas.find((s) => s.id === activeSchemaId);
    if (!sf) return new Set<string>();
    const names = new Set<string>();
    for (const classDef of Object.values(sf.schema.classes)) {
      if (classDef.isA) names.add(classDef.isA);
      for (const m of classDef.mixins) names.add(m);
      if (classDef.unionOf) for (const u of classDef.unionOf) names.add(u);
      for (const slot of Object.values(classDef.attributes)) {
        if (slot.range) names.add(slot.range);
      }
    }
    return names;
  }, [activeProject, activeSchemaId]);

  // Build a list of all entities grouped by schema, with referenced entities first
  const groups = useMemo(() => {
    if (!activeProject) return [];
    const lower = query.toLowerCase();

    return activeProject.schemas.map((sf) => {
      const classNames = Object.keys(sf.schema.classes).sort();
      const enumNames = Object.keys(sf.schema.enums).sort();
      const rows: EntityRow[] = [
        ...classNames.map((n) => ({
          name: n,
          type: 'class' as const,
          schemaId: sf.id,
          filePath: sf.filePath,
          isReadOnly: !!sf.isReadOnly,
        })),
        ...enumNames.map((n) => ({
          name: n,
          type: 'enum' as const,
          schemaId: sf.id,
          filePath: sf.filePath,
          isReadOnly: !!sf.isReadOnly,
        })),
      ].filter((r) => !lower || r.name.toLowerCase().includes(lower));

      // Sort: referenced entities first (alpha), then unreferenced (alpha)
      rows.sort((a, b) => {
        const aRef = activeSchemaReferencedNames.has(a.name);
        const bRef = activeSchemaReferencedNames.has(b.name);
        if (aRef !== bRef) return aRef ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return { schemaId: sf.id, filePath: sf.filePath, isReadOnly: !!sf.isReadOnly, rows };
    }).filter((g) => g.rows.length > 0);
  }, [activeProject, activeSchemaReferencedNames, query]);

  // Determine which entity names are in the active schema
  const activeSchemaEntityNames = useMemo(() => {
    if (!activeProject || !activeSchemaId) return new Set<string>();
    const sf = activeProject.schemas.find((s) => s.id === activeSchemaId);
    if (!sf) return new Set<string>();
    return new Set([
      ...Object.keys(sf.schema.classes),
      ...Object.keys(sf.schema.enums),
    ]);
  }, [activeProject, activeSchemaId]);

  const handleRowClick = (row: EntityRow) => {
    if (row.schemaId !== activeSchemaId && !row.isReadOnly) {
      setActiveSchema(row.schemaId);
    }
    requestFocusNode(row.name);
    if (row.type === 'class') {
      setActiveEntity({ type: 'class', className: row.name });
    } else {
      setActiveEntity({ type: 'enum', enumName: row.name });
    }
  };

  const totalCount = groups.reduce((acc, g) => acc + g.rows.length, 0);

  return (
    <div style={styles.container}>
      <div style={styles.inputWrapper}>
        <input
          style={styles.searchInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search classes and enums…"
          autoFocus
        />
      </div>
      <div style={styles.results}>
        {totalCount === 0 ? (
          <div style={styles.empty}>No results</div>
        ) : (
          groups.map((g) => {
            const label = g.filePath.split('/').pop() ?? g.filePath;
            return (
              <div key={g.schemaId}>
                <div style={styles.groupHeader}>
                  <span style={styles.groupLabel}>{label}</span>
                  {g.isReadOnly && <span style={styles.importedBadge}>imported</span>}
                </div>
                {g.rows.map((row) => {
                  const inActive = activeSchemaEntityNames.has(row.name) && row.schemaId === activeSchemaId;
                  const isReferenced = activeSchemaReferencedNames.has(row.name) && row.schemaId !== activeSchemaId;
                  return (
                    <button
                      type="button"
                      key={`${row.schemaId}:${row.type}:${row.name}`}
                      style={styles.row}
                      onClick={() => handleRowClick(row)}
                      title={`${row.type}: ${row.name} (${row.filePath})`}
                    >
                      <span
                        style={{
                          ...styles.typeBadge,
                          ...(row.type === 'class' ? styles.classBadge : styles.enumBadge),
                        }}
                      >
                        {row.type === 'class' ? 'cls' : 'enm'}
                      </span>
                      <span style={styles.entityName}>{row.name}</span>
                      {inActive && <span style={styles.activeMark} title="In active schema">✓</span>}
                      {isReferenced && <span style={styles.referencedMark} title="Referenced by active schema">→</span>}
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
    background: 'var(--color-bg-canvas)',
  },
  inputWrapper: {
    padding: '6px 8px',
    borderBottom: '1px solid var(--color-border-subtle)',
    flexShrink: 0,
  },
  searchInput: {
    width: '100%',
    boxSizing: 'border-box',
    background: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 4,
    color: 'var(--color-fg-primary)',
    fontSize: 11,
    padding: '4px 7px',
    outline: 'none',
  },
  results: {
    flex: 1,
    overflowY: 'auto',
  },
  empty: {
    padding: 12,
    fontSize: 11,
    color: 'var(--color-border-strong)',
    fontStyle: 'italic',
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 8px 2px',
    borderBottom: '1px solid #0d1627',
  },
  groupLabel: {
    fontSize: 9,
    color: 'var(--color-border-strong)',
    fontFamily: 'var(--font-family-mono)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  importedBadge: {
    fontSize: 8,
    background: 'var(--color-bg-surface)',
    borderRadius: 3,
    padding: '1px 4px',
    color: 'var(--color-border-strong)',
    flexShrink: 0,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 8px',
    cursor: 'pointer',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    borderBottom: '1px solid transparent',
    userSelect: 'none',
    background: 'none',
    width: '100%',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    color: 'inherit',
    textAlign: 'left' as const,
  },
  typeBadge: {
    fontSize: 8,
    borderRadius: 3,
    padding: '1px 4px',
    flexShrink: 0,
    fontWeight: 600,
  },
  classBadge: {
    background: 'var(--color-state-info-bg)',
    color: 'var(--color-state-info)',
  },
  enumBadge: {
    background: 'var(--color-state-warning-bg)',
    color: 'var(--color-state-warning)',
  },
  entityName: {
    fontSize: 11,
    fontFamily: 'var(--font-family-mono)',
    color: 'var(--color-fg-primary)',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  activeMark: {
    fontSize: 9,
    color: 'var(--color-state-success)',
    flexShrink: 0,
  },
  referencedMark: {
    fontSize: 9,
    color: 'var(--color-accent-hover)',
    flexShrink: 0,
  },
};
