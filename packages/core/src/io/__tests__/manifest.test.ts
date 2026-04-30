import { describe, it, expect } from 'vitest';
import { parseManifest, serializeManifest } from '../manifest.js';

describe('parseManifest', () => {
  it('returns empty object for empty string', () => {
    expect(parseManifest('')).toEqual({});
  });

  it('returns empty object for null-like YAML (just whitespace)', () => {
    expect(parseManifest('   \n')).toEqual({});
  });

  it('returns empty object for non-object YAML (array)', () => {
    expect(parseManifest('- a\n- b')).toEqual({});
  });

  it('returns empty object for non-object YAML (scalar)', () => {
    expect(parseManifest('hello')).toEqual({});
  });

  it('parses schema_order', () => {
    const raw = 'schema_order:\n  - foo.yaml\n  - bar.yaml\n';
    expect(parseManifest(raw)).toEqual({ schemaOrder: ['foo.yaml', 'bar.yaml'] });
  });

  it('filters non-string entries in schema_order', () => {
    const raw = 'schema_order:\n  - foo.yaml\n  - 42\n  - bar.yaml\n';
    const result = parseManifest(raw);
    expect(result.schemaOrder).toEqual(['foo.yaml', 'bar.yaml']);
  });

  it('ignores schema_order if not an array', () => {
    const raw = 'schema_order: foo.yaml\n';
    expect(parseManifest(raw)).toEqual({});
  });

  it('parses default_open_schema', () => {
    const raw = 'default_open_schema: main.yaml\n';
    expect(parseManifest(raw)).toEqual({ defaultOpenSchema: 'main.yaml' });
  });

  it('ignores default_open_schema if not a string', () => {
    const raw = 'default_open_schema: 42\n';
    expect(parseManifest(raw)).toEqual({});
  });

  it('parses preferences with all fields', () => {
    const raw = [
      'preferences:',
      '  auto_manage_imports: false',
      '  show_ghost_nodes: false',
      '  default_layout: LR',
    ].join('\n');
    const result = parseManifest(raw);
    expect(result.preferences).toEqual({
      autoManageImports: false,
      showGhostNodes: false,
      defaultLayout: 'LR',
    });
  });

  it('defaults auto_manage_imports to true when absent', () => {
    const raw = 'preferences:\n  show_ghost_nodes: false\n';
    const result = parseManifest(raw);
    expect(result.preferences?.autoManageImports).toBe(true);
  });

  it('defaults show_ghost_nodes to true when absent', () => {
    const raw = 'preferences:\n  auto_manage_imports: false\n';
    const result = parseManifest(raw);
    expect(result.preferences?.showGhostNodes).toBe(true);
  });

  it('defaults default_layout to TB for unknown values', () => {
    const raw = 'preferences:\n  default_layout: DIAGONAL\n';
    const result = parseManifest(raw);
    expect(result.preferences?.defaultLayout).toBe('TB');
  });

  it('accepts all valid layout values', () => {
    for (const layout of ['TB', 'BT', 'LR', 'RL'] as const) {
      const raw = `preferences:\n  default_layout: ${layout}\n`;
      expect(parseManifest(raw).preferences?.defaultLayout).toBe(layout);
    }
  });

  it('ignores preferences when not an object', () => {
    const raw = 'preferences: not_an_object\n';
    expect(parseManifest(raw)).toEqual({});
  });

  it('parses all fields together', () => {
    const raw = [
      'schema_order:',
      '  - a.yaml',
      '  - b.yaml',
      'default_open_schema: a.yaml',
      'preferences:',
      '  auto_manage_imports: true',
      '  show_ghost_nodes: true',
      '  default_layout: BT',
    ].join('\n');
    expect(parseManifest(raw)).toEqual({
      schemaOrder: ['a.yaml', 'b.yaml'],
      defaultOpenSchema: 'a.yaml',
      preferences: {
        autoManageImports: true,
        showGhostNodes: true,
        defaultLayout: 'BT',
      },
    });
  });
});

describe('serializeManifest', () => {
  it('serializes empty manifest to empty YAML', () => {
    const result = serializeManifest({});
    expect(result.trim()).toBe('{}');
  });

  it('serializes schemaOrder', () => {
    const result = serializeManifest({ schemaOrder: ['a.yaml', 'b.yaml'] });
    expect(result).toContain('schema_order:');
    expect(result).toContain('a.yaml');
    expect(result).toContain('b.yaml');
  });

  it('omits schemaOrder when empty array', () => {
    const result = serializeManifest({ schemaOrder: [] });
    expect(result).not.toContain('schema_order');
  });

  it('serializes defaultOpenSchema', () => {
    const result = serializeManifest({ defaultOpenSchema: 'main.yaml' });
    expect(result).toContain('default_open_schema: main.yaml');
  });

  it('omits defaultOpenSchema when not set', () => {
    const result = serializeManifest({});
    expect(result).not.toContain('default_open_schema');
  });

  it('serializes preferences with all fields', () => {
    const result = serializeManifest({
      preferences: {
        autoManageImports: false,
        showGhostNodes: true,
        defaultLayout: 'LR',
      },
    });
    expect(result).toContain('auto_manage_imports: false');
    expect(result).toContain('show_ghost_nodes: true');
    expect(result).toContain('default_layout: LR');
  });

  it('omits preferences when all sub-fields undefined', () => {
    // preferences object with no keys → no output
    const result = serializeManifest({ preferences: {} as never });
    expect(result).not.toContain('preferences');
  });

  it('round-trips a full manifest', () => {
    const original = {
      schemaOrder: ['a.yaml', 'b.yaml'],
      defaultOpenSchema: 'a.yaml',
      preferences: {
        autoManageImports: true,
        showGhostNodes: false,
        defaultLayout: 'RL' as const,
      },
    };
    const serialized = serializeManifest(original);
    const roundTripped = parseManifest(serialized);
    expect(roundTripped).toEqual(original);
  });
});
