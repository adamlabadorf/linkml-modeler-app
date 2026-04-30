import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PropertiesPanel } from '../PropertiesPanel.js';
import { useAppStore } from '../../store/index.js';
import { PlatformContext, type PlatformAPI } from '../../platform/PlatformContext.js';
import type { Project, SchemaFile } from '../../model/index.js';
import {
  emptyCanvasLayout,
  emptySchema,
  emptyClassDefinition,
  emptyEnumDefinition,
  emptySlotDefinition,
} from '../../model/index.js';
import type { Edge } from 'reactflow';

// ── Mock platform ─────────────────────────────────────────────────────────────

const mockPlatform: PlatformAPI = {
  openFile: vi.fn().mockResolvedValue(null),
  saveFile: vi.fn().mockResolvedValue(null),
  openDirectory: vi.fn().mockResolvedValue(null),
  readFile: vi.fn().mockResolvedValue(''),
  writeFile: vi.fn().mockResolvedValue(undefined),
  listDirectory: vi.fn().mockResolvedValue([]),
  initGit: vi.fn().mockResolvedValue(false),
  gitCreateRepo: vi.fn().mockResolvedValue(false),
  gitSetRemote: vi.fn().mockResolvedValue(undefined),
  gitReadConfig: vi.fn().mockResolvedValue({}),
  gitStatus: vi.fn().mockResolvedValue(null),
  gitStage: vi.fn().mockResolvedValue(undefined),
  gitUnstage: vi.fn().mockResolvedValue(undefined),
  gitCommit: vi.fn().mockResolvedValue(null),
  gitPush: vi.fn().mockResolvedValue(null),
  gitPull: vi.fn().mockResolvedValue(null),
  gitLog: vi.fn().mockResolvedValue([]),
  gitClone: vi.fn().mockResolvedValue({ ok: false, destPath: '' }),
  gitCheckout: vi.fn().mockResolvedValue(undefined),
  storeCredential: vi.fn().mockResolvedValue(undefined),
  getCredential: vi.fn().mockResolvedValue(null),
  deleteCredential: vi.fn().mockResolvedValue(undefined),
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn().mockResolvedValue(undefined),
  platform: 'web',
  gitAvailable: false,
  getProjectsPath: vi.fn().mockResolvedValue('/tmp'),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSchemaFile(name: string): SchemaFile {
  return {
    id: crypto.randomUUID(),
    filePath: `${name}.yaml`,
    schema: emptySchema(name, `https://example.org/${name}`, name),
    isDirty: false,
    canvasLayout: emptyCanvasLayout(),
  };
}

function makeProject(name: string, schemas: SchemaFile[]): Project {
  return {
    id: crypto.randomUUID(),
    name,
    rootPath: `/tmp/${name}`,
    schemas,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Capture initial store state at module load time for reset between tests
const INITIAL_STATE = useAppStore.getState();

function renderPanel() {
  return render(
    <PlatformContext.Provider value={mockPlatform}>
      <PropertiesPanel />
    </PlatformContext.Provider>
  );
}

// ── Test setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  useAppStore.setState(INITIAL_STATE, true);
  vi.clearAllMocks();
});

// ── Scenarios ─────────────────────────────────────────────────────────────────

describe('PropertiesPanel', () => {
  it('empty selection: renders schema metadata form when a schema is active', () => {
    const sf = makeSchemaFile('core');
    useAppStore.getState().setProject(makeProject('test', [sf]));
    // activeEntity is null (default)

    renderPanel();

    expect(screen.getByText('Schema Identity')).toBeInTheDocument();
  });

  it('class selection: renders class form and is_a dropdown excludes the selected class', () => {
    const sf = makeSchemaFile('core');
    sf.schema.classes['Person'] = emptyClassDefinition('Person');
    sf.schema.classes['Animal'] = emptyClassDefinition('Animal');
    const project = makeProject('test', [sf]);
    useAppStore.getState().setProject(project);
    useAppStore.getState().setActiveEntity({ type: 'class', className: 'Person' });

    renderPanel();

    expect(screen.getByText('Class Properties')).toBeInTheDocument();

    // Open the is_a dropdown by focusing its input
    const isALabel = screen.getByText('is_a');
    const isAInput = isALabel.parentElement!.querySelector('input')!;
    fireEvent.focus(isAInput);

    // The dropdown container (tabindex="-1") is inside the is_a FieldRow
    const isAWrapper = isALabel.parentElement!.querySelector('[tabindex="-1"]')!;
    expect(within(isAWrapper as HTMLElement).getByText('Animal')).toBeInTheDocument();
    expect(within(isAWrapper as HTMLElement).queryByText('Person')).not.toBeInTheDocument();
  });

  it('slot selection: slot header chip visible, expansion body collapsed by default', () => {
    const sf = makeSchemaFile('core');
    sf.schema.classes['Person'] = {
      ...emptyClassDefinition('Person'),
      attributes: { name: emptySlotDefinition('name') },
    };
    const project = makeProject('test', [sf]);
    useAppStore.getState().setProject(project);
    useAppStore.getState().setActiveEntity({ type: 'slot', className: 'Person', slotName: 'name' });

    renderPanel();

    // Slot header chip (always visible): slot name appears as a span
    expect(screen.getByText('name')).toBeInTheDocument();
    // Expansion toggle is visible (collapsed state shows ▸)
    expect(screen.getByText('▸')).toBeInTheDocument();
    // Expansion body is collapsed — Tier 1 flags label is not rendered
    expect(screen.queryByText('Tier 1 flags')).not.toBeInTheDocument();
  });

  it('enum selection: renders enum form with permissible values list', () => {
    const sf = makeSchemaFile('core');
    sf.schema.enums['Status'] = {
      ...emptyEnumDefinition('Status'),
      permissibleValues: {
        active: { text: 'active' },
        inactive: { text: 'inactive' },
      },
    };
    const project = makeProject('test', [sf]);
    useAppStore.getState().setProject(project);
    useAppStore.getState().setActiveEntity({ type: 'enum', enumName: 'Status' });

    renderPanel();

    expect(screen.getByText('Permissible Values')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('inactive')).toBeInTheDocument();
  });

  it('edge selection: renders edge relationship details', () => {
    const sf = makeSchemaFile('core');
    const project = makeProject('test', [sf]);
    useAppStore.getState().setProject(project);

    // Seed an is_a edge in the canvas store
    const testEdge: Edge = {
      id: 'is_a__Person__Animal',
      source: 'Person',
      target: 'Animal',
      type: 'is_a',
    };
    useAppStore.setState({ edges: [testEdge] });
    useAppStore.getState().setActiveEntity({ type: 'edge', edgeId: 'is_a__Person__Animal' });

    renderPanel();

    expect(screen.getByText('Edge (read-only)')).toBeInTheDocument();
    expect(screen.getByText('Person')).toBeInTheDocument();
    expect(screen.getByText('Animal')).toBeInTheDocument();
  });
});
