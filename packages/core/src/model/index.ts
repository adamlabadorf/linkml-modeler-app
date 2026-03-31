// LinkML Visual Editor — Internal Data Model
// Mirrors the LinkML metamodel (Section 4 of design spec)

// ─── 4.1 Project ─────────────────────────────────────────────────────────────

export interface Project {
  id: string; // UUID
  name: string;
  rootPath: string; // Absolute path (Electron) or OPFS path (web)
  schemas: SchemaFile[]; // Ordered list; first is the "root" schema
  gitConfig?: GitConfig;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

export interface SchemaFile {
  id: string;
  filePath: string; // Relative to rootPath
  schema: LinkMLSchema; // Parsed in-memory representation
  isDirty: boolean; // Unsaved local changes
  canvasLayout: CanvasLayout; // Node positions (stored alongside .yaml)
  isReadOnly?: boolean; // True for imported (dependency) schemas
}

// ─── 4.1b Editor Manifest (.linkml-editor.yaml) ───────────────────────────────

export interface EditorManifest {
  schemaOrder?: string[]; // Relative file paths, controls panel order
  defaultOpenSchema?: string; // Relative file path of default schema to open
  preferences?: EditorPreferences;
}

export interface EditorPreferences {
  autoManageImports?: boolean; // Auto-add/remove imports when ranges change (default: true)
  showGhostNodes?: boolean; // Show imported classes as ghost nodes (default: true)
  defaultLayout?: 'TB' | 'BT' | 'LR' | 'RL'; // Default ELK layout direction
}

export interface GitConfig {
  enabled: boolean; // False if Git not detected on system
  remoteUrl?: string;
  defaultBranch: string;
  userName?: string;
  userEmail?: string;
}

// ─── 4.2 LinkML Schema ────────────────────────────────────────────────────────

export interface LinkMLSchema {
  id: string; // URI, e.g. "https://example.org/my-schema"
  name: string; // Short identifier
  title?: string;
  description?: string;
  version?: string;
  license?: string;
  prefixes: Record<string, string>; // e.g. { "linkml": "https://w3id.org/linkml/" }
  defaultPrefix: string;
  defaultRange?: string;
  imports: string[]; // e.g. ["linkml:types", "../other-schema"]
  subsets: Record<string, SubsetDefinition>;
  types: Record<string, TypeDefinition>;
  enums: Record<string, EnumDefinition>;
  classes: Record<string, ClassDefinition>;
  extras?: Record<string, unknown>; // Unknown top-level keys preserved for round-trip
}

// ─── 4.3 Classes ─────────────────────────────────────────────────────────────

export interface ClassDefinition {
  name: string;
  description?: string;
  isA?: string; // Single parent class name
  mixins: string[]; // Mixin class names
  abstract?: boolean;
  mixin?: boolean; // This class is itself a mixin
  treeRoot?: boolean;
  subsetOf?: string[]; // Subset membership
  slots: string[]; // References to schema-level slots (v1.x)
  attributes: Record<string, SlotDefinition>; // Inline attributes (v1.0 primary)
  slotUsage: Record<string, Partial<SlotDefinition>>; // Overrides for inherited slots
  unionOf?: string[]; // Class union
  uriAnnotation?: string; // class_uri
  fromSchema?: string;
  extras?: Record<string, unknown>;
}

// ─── 4.4 Slots / Attributes ──────────────────────────────────────────────────

export interface SlotDefinition {
  name: string;
  description?: string;
  range?: string; // Type, class name, or enum name
  required?: boolean;
  recommended?: boolean;
  multivalued?: boolean;
  identifier?: boolean;
  keyField?: boolean;
  inlined?: boolean;
  inlinedAsList?: boolean;
  domain?: string; // Owning class (for schema-level slots)
  domainOf?: string[];
  subsetOf?: string[];
  ifAbsent?: string;
  alias?: string;
  slotUri?: string; // URI binding
  mappings?: string[]; // Ontology term CURIEs
  exactMappings?: string[];
  closeMappings?: string[];
  broadMappings?: string[];
  narrowMappings?: string[];
  // Advanced properties (v1.x) stored as opaque `extras` to round-trip without data loss
  extras?: Record<string, unknown>;
}

// ─── 4.5 Enumerations ────────────────────────────────────────────────────────

export interface EnumDefinition {
  name: string;
  description?: string;
  permissibleValues: Record<string, PermissibleValue>;
  codeSet?: string; // URI of external value set
  reachableFrom?: ReachableFrom;
  subsetOf?: string[];
  extras?: Record<string, unknown>;
}

export interface PermissibleValue {
  text: string;
  description?: string;
  meaning?: string; // URI / CURIE binding
}

export interface ReachableFrom {
  sourceOntology: string;
  sourceNodes?: string[];
  relationship?: string;
}

// ─── 4.6 Subsets ─────────────────────────────────────────────────────────────

export interface SubsetDefinition {
  name: string;
  description?: string;
  extras?: Record<string, unknown>;
}

// ─── 4.7 Types ───────────────────────────────────────────────────────────────

export interface TypeDefinition {
  name: string;
  uri?: string;
  description?: string;
  typeof?: string; // Parent type
  extras?: Record<string, unknown>;
}

// ─── 4.8 Canvas Layout ───────────────────────────────────────────────────────

export interface CanvasLayout {
  nodes: Record<string, NodeLayout>; // keyed by class/enum name
  viewport: { x: number; y: number; zoom: number };
}

export interface NodeLayout {
  x: number;
  y: number;
  collapsed?: boolean;
}

// ─── Factories / helpers ─────────────────────────────────────────────────────

export function emptyCanvasLayout(): CanvasLayout {
  return { nodes: {}, viewport: { x: 0, y: 0, zoom: 1 } };
}

export function emptySchema(name: string, id: string, defaultPrefix: string): LinkMLSchema {
  return {
    id,
    name,
    prefixes: { linkml: 'https://w3id.org/linkml/' },
    defaultPrefix,
    imports: ['linkml:types'],
    subsets: {},
    types: {},
    enums: {},
    classes: {},
  };
}

export function emptyClassDefinition(name: string): ClassDefinition {
  return {
    name,
    mixins: [],
    slots: [],
    attributes: {},
    slotUsage: {},
  };
}

export function emptySlotDefinition(name: string): SlotDefinition {
  return { name };
}

export function emptyEnumDefinition(name: string): EnumDefinition {
  return { name, permissibleValues: {} };
}
