# LinkML Visual Schema Editor — High-Level Design Specification

**Version:** 1.0-draft  
**Status:** For implementation by coding agents  
**Scope:** v1.0 feature set

---

## 1. Executive Summary

The **LinkML Visual Schema Editor** is a cross-platform graphical tool for authoring, editing, and visualizing [LinkML](https://linkml.io/) schemas using an Entity-Relationship Diagram (ERD) style canvas. It addresses a recognized gap in the LinkML ecosystem: there is currently no GUI tool for schema authoring — users must hand-edit YAML files. The editor targets bioinformatics researchers, data modelers, and ontology engineers who need to design linked data schemas without memorizing YAML syntax.

The tool is delivered as:
- A **standalone web application** (static build, deployable to any web server or GitHub Pages)
- An **Electron desktop application** using the same codebase with a thin platform harness

---

## 2. Goals and Non-Goals

### Goals (v1.0)
- Visual, canvas-based authoring of LinkML schemas
- Full round-trip: load existing LinkML YAML → render on canvas → edit → export valid YAML
- First-class support for: classes, slots/attributes, inheritance, mixins, enumerations, ontology/URI bindings, subsets
- Project management: collections of related schema files sharing a namespace hierarchy
- Focus/isolation modes for working on schema subsets
- Git integration when Git is available on the host system
- Shared codebase between web and Electron targets with platform-specific harnesses

### Non-Goals (v1.0)
- Downstream code generation (JSON Schema, Python dataclasses, OWL, etc.)
- Real-time collaborative editing
- A backend server or cloud persistence (beyond optional Git remote push)
- Full bidirectional live sync between YAML text editor and canvas (import/export only)
- Support for the complete LinkML slot metamodel (advanced properties deferred to v1.x)

---

## 3. Technology Stack

### Recommended Libraries

| Concern | Library | Rationale |
|---|---|---|
| UI framework | **React 18** + TypeScript | Broad ecosystem, strong typing, required by most canvas libs |
| Canvas / diagram engine | **ReactFlow v11+** | Best-in-class React ERD/graph library; large community; custom node types; performant for 100s of nodes |
| State management | **Zustand** | Lightweight, no boilerplate, works well with ReactFlow's store pattern |
| YAML parsing/serialization | **js-yaml** | De facto standard; handles LinkML's YAML dialect |
| Schema validation | Custom structural validator | Structural and naming checks: PascalCase/snake_case conventions, is_a/mixin/range reference existence, inheritance cycle detection. No metamodel JSON Schema validation. |
| UI component library | **shadcn/ui** (Radix + Tailwind) | Unstyled accessible primitives; good fit for tool-style UIs |
| File I/O (web) | **File System Access API** with fallback to `<input type="file">` download | Native file dialogs in modern browsers |
| File I/O (Electron) | **Electron `dialog`** + Node `fs` | Full filesystem access |
| Git integration | **isomorphic-git** + `@isogit/lightning-fs` | Pure JS Git client; no native dependency; works in both web (localStorage backend) and Electron (real `fs` backend); gracefully detectable |
| Build / bundler | **Vite** | Fast dev server; handles both web output and Electron renderer |
| Electron harness | **electron-vite** | Purpose-built Vite + Electron integration |
| Testing | **Vitest** + **Playwright** | Unit and E2E, same toolchain as Vite |

### Repository Structure

```
linkml-visual-editor/
├── packages/
│   ├── core/              # Shared React app (renderer)
│   │   ├── src/
│   │   │   ├── canvas/    # ReactFlow nodes, edges, layout
│   │   │   ├── editor/    # Property panels, forms
│   │   │   ├── store/     # Zustand state
│   │   │   ├── io/        # YAML parse/emit, Git
│   │   │   ├── model/     # TypeScript types mirroring LinkML metamodel
│   │   │   └── ui/        # shadcn components, layout chrome
│   │   └── ...
│   ├── web/               # Vite web build harness
│   └── electron/          # Electron main process + harness
├── docs/
└── ...
```

The `core` package has **zero** Electron or Node.js imports. Platform differences (file dialogs, Git filesystem backend, window chrome) are injected via a `PlatformContext` React context provider, implemented separately in `web/` and `electron/`.

---

## 4. Data Model

The editor's internal state mirrors the LinkML metamodel. The following TypeScript interfaces define the v1.0 scope.

### 4.1 Project

A **Project** is the top-level container, corresponding to a directory on disk.

```typescript
interface Project {
  id: string;                    // UUID
  name: string;
  rootPath: string;              // Absolute path (Electron) or OPFS path (web)
  schemas: SchemaFile[];         // Ordered list; first is the "root" schema
  gitConfig?: GitConfig;
  createdAt: string;             // ISO 8601
  updatedAt: string;
}

interface SchemaFile {
  id: string;
  filePath: string;              // Relative to rootPath
  schema: LinkMLSchema;          // Parsed in-memory representation
  isDirty: boolean;              // Unsaved local changes
  canvasLayout: CanvasLayout;    // Node positions (stored alongside .yaml)
}

interface GitConfig {
  enabled: boolean;              // False if Git not detected on system
  remoteUrl?: string;
  defaultBranch: string;
  userName?: string;
  userEmail?: string;
}
```

### 4.2 LinkML Schema (Internal Model)

These types represent the v1.0 subset of the LinkML metamodel. They are the source of truth for both the canvas and YAML serialization.

```typescript
interface LinkMLSchema {
  id: string;                    // URI, e.g. "https://example.org/my-schema"
  name: string;                  // Short identifier
  title?: string;
  description?: string;
  version?: string;
  license?: string;
  prefixes: Record<string, string>;   // e.g. { "linkml": "https://w3id.org/linkml/" }
  defaultPrefix: string;
  defaultRange?: string;
  imports: string[];             // e.g. ["linkml:types", "../other-schema"]
  subsets: Record<string, SubsetDefinition>;
  types: Record<string, TypeDefinition>;
  enums: Record<string, EnumDefinition>;
  classes: Record<string, ClassDefinition>;
}

// 4.3 Classes
interface ClassDefinition {
  name: string;
  description?: string;
  isA?: string;                  // Single parent class name
  mixins: string[];              // Mixin class names
  abstract?: boolean;
  mixin?: boolean;               // This class is itself a mixin
  treeRoot?: boolean;
  subsetOf?: string[];           // Subset membership
  slots: string[];               // References to schema-level slots (v1.x)
  attributes: Record<string, SlotDefinition>;  // Inline attributes (v1.0 primary)
  slotUsage: Record<string, Partial<SlotDefinition>>;  // Overrides for inherited slots
  unionOf?: string[];            // Class union
  uriAnnotation?: string;        // class_uri
  fromSchema?: string;
}

// 4.4 Slots / Attributes (v1.0 "common tier" — see Section 8 for extensibility)
interface SlotDefinition {
  name: string;
  description?: string;
  range?: string;                // Type, class name, or enum name
  required?: boolean;
  recommended?: boolean;
  multivalued?: boolean;
  identifier?: boolean;
  keyField?: boolean;
  inlined?: boolean;
  inlinedAsList?: boolean;
  domain?: string;               // Owning class (for schema-level slots)
  domainOf?: string[];
  subsetOf?: string[];
  ifAbsent?: string;
  alias?: string;
  slotUri?: string;              // URI binding
  mappings?: string[];           // Ontology term CURIEs
  exactMappings?: string[];
  closeMappings?: string[];
  broadMappings?: string[];
  narrowMappings?: string[];
  // Advanced properties (v1.x) stored as opaque `extras` to round-trip without data loss
  extras?: Record<string, unknown>;
}

// 4.5 Enumerations
interface EnumDefinition {
  name: string;
  description?: string;
  permissibleValues: Record<string, PermissibleValue>;
  codeSet?: string;              // URI of external value set
  reachableFrom?: ReachableFrom;
  subsetOf?: string[];
}

interface PermissibleValue {
  text: string;
  description?: string;
  meaning?: string;              // URI / CURIE binding
}

// 4.6 Subsets
interface SubsetDefinition {
  name: string;
  description?: string;
}

// 4.7 Types
interface TypeDefinition {
  name: string;
  uri?: string;
  description?: string;
  typeof?: string;               // Parent type
}
```

### 4.8 Canvas Layout

Stored in a sidecar `.layout.json` file alongside each `.yaml` file. Not part of the YAML output.

```typescript
interface CanvasLayout {
  nodes: Record<string, NodeLayout>;  // keyed by class/enum name
  viewport: { x: number; y: number; zoom: number };
}

interface NodeLayout {
  x: number;
  y: number;
  collapsed?: boolean;
}
```

---

## 5. Application Architecture

### 5.1 State Management

All application state lives in a single Zustand store, organized into slices:

```
AppStore
├── ProjectSlice       — active project, open files, dirty state
├── CanvasSlice        — ReactFlow nodes/edges, viewport, selection
├── EditorSlice        — active selection, panel open/closed, focus mode state
├── GitSlice           — git status, staged files, commit history
└── UISlice            — theme, panel sizes, toast queue
```

The `ProjectSlice` is the single source of truth for schema content. The `CanvasSlice` is derived from it (schemas → nodes/edges) via a selector, not independently stored. Changes flow: **user action → store mutation → canvas re-derives**.

### 5.2 YAML Round-Trip

```
Load flow:   disk file → js-yaml parse → structural validation → LinkMLSchema object → canvas nodes/edges
Save flow:   LinkMLSchema object → YAML serializer → validate → write to disk
```

The YAML serializer must:
- Preserve key ordering (id, name, prefixes, imports, subsets, types, enums, classes)
- Emit only non-default values (no empty arrays or null fields)
- Preserve unknown top-level keys and slot `extras` to avoid data loss on partial-metamodel schemas
- Use block style for all mappings and sequences (not flow style)

### 5.3 Platform Abstraction (`PlatformContext`)

```typescript
interface PlatformAPI {
  // File system
  openFile(options: OpenFileOptions): Promise<FileResult | null>;
  saveFile(options: SaveFileOptions, content: string): Promise<string | null>;
  openDirectory(): Promise<string | null>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listDirectory(path: string): Promise<DirEntry[]>;

  // Git (all methods no-op and return null/false if git unavailable)
  gitStatus(repoPath: string): Promise<GitStatus | null>;
  gitStage(repoPath: string, paths: string[]): Promise<void>;
  gitCommit(repoPath: string, message: string): Promise<string | null>;
  gitPush(repoPath: string): Promise<GitPushResult | null>;
  gitLog(repoPath: string, limit: number): Promise<GitCommit[]>;

  // Environment
  platform: 'web' | 'electron';
  gitAvailable: boolean;          // Detected at startup
}
```

Web implementation uses File System Access API + isomorphic-git with OPFS backend.  
Electron implementation uses `ipcRenderer` bridges to the main process, which uses Node `fs` + isomorphic-git with real filesystem.

---

## 6. User Interface

### 6.1 Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Menu Bar / Title Bar                                  [Git status] │
├──────────────┬──────────────────────────────────────┬───────────────┤
│              │                                      │               │
│  Project     │         Canvas                       │  Properties   │
│  Panel       │         (ReactFlow)                  │  Panel        │
│  (left)      │                                      │  (right)      │
│              │                                      │               │
│  - Project   │  [node] ──── [node]                  │  [slot editor]│
│    tree      │     │                                │  [class props]│
│  - Schema    │  [node]                              │  [enum editor]│
│    files     │                                      │               │
│  - Subsets   │                                      │               │
├──────────────┴──────────────────────────────────────┴───────────────┤
│  Status Bar: file path | validation status | git branch | zoom      │
└─────────────────────────────────────────────────────────────────────┘
```

All three panels are resizable and collapsible. The canvas occupies the remaining space.

### 6.2 Canvas Nodes

Each LinkML entity type maps to a distinct visual node type in ReactFlow:

#### Class Node
```
┌─────────────────────────────────┐
│ 🔷 ClassName          [abstract]│  ← header (color-coded by type)
│    is_a: ParentClass             │
├─────────────────────────────────┤
│ + slot_name : range  [R] [M]    │  ← R = required, M = multivalued
│ + another   : string [id]       │  ← [id] = identifier
│ ...                             │
│ [+ add slot]                    │
└─────────────────────────────────┘
```

- **Mixin classes** have a distinct header color and a `[mixin]` badge
- **Abstract classes** have an italic title and `[abstract]` badge
- Slots with a `range` pointing to another class show a connection handle
- Nodes are collapsible (hide slot list, show only header)

#### Enum Node
```
┌─────────────────────────────────┐
│ 🔶 EnumName                     │
├─────────────────────────────────┤
│   VALUE_ONE                     │
│   VALUE_TWO  → skos:exactMatch  │
│ [+ add value]                   │
└─────────────────────────────────┘
```

#### Edge Types

| Relationship | Visual Style |
|---|---|
| `range` (slot → class) | Solid arrow, labeled with slot name |
| `is_a` (inheritance) | Hollow triangle arrowhead (UML style) |
| `mixin` usage | Dashed line, hollow triangle arrowhead |
| `union_of` | Dotted line |

### 6.3 Project Panel

- Tree view of the project directory, showing `.yaml` schema files
- Each schema file shows its namespace prefix and class/enum count
- Right-click context menu: rename, delete, set as root, open in canvas
- "New Schema File" button with namespace/prefix configuration dialog
- Subset list: click to activate focus mode for that subset

### 6.4 Properties Panel

Context-sensitive. Shows different forms depending on selection:

**Nothing selected:** Schema-level metadata (id, name, title, description, version, license, prefixes, default_prefix, default_range, imports)

**Class selected:** Class properties form (name, description, is_a selector, mixins multi-select, abstract toggle, mixin toggle, tree_root toggle, class_uri, subset membership, slot list with reorder)

**Slot selected (within class):** Full slot editor (see Section 8)

**Enum selected:** Enum editor (name, description, permissible values list with add/remove/reorder, per-value meaning URI)

**Edge selected:** Relationship details (slot name, cardinality summary, navigate to source/target)

### 6.5 Focus / Isolation Mode

Two mechanisms, independent or combined:

1. **Subset-based focus:** Select a named subset from the Project Panel. All canvas nodes/edges that do NOT have membership in that subset are dimmed (50% opacity) and non-interactive. A banner shows the active subset with an "Exit focus" button.

2. **Selection-based focus:** User selects one or more nodes (shift-click or rubber-band), then triggers "Focus on selection" (keyboard shortcut or context menu). Non-selected nodes dim. The focus persists until dismissed.

In both modes:
- Dimmed nodes cannot be edited but remain visible for context
- The active (non-dimmed) subgraph can be panned/zoomed independently with "Fit focused nodes" action
- Focus mode is indicated in the status bar

### 6.6 Schema Metadata & URI/Prefix Panel

Accessible via a dedicated "Schema Settings" sheet/dialog from the menu or schema node context menu.

Sections:
- **Identity:** `id` (URI), `name`, `title`, `description`, `version`, `license`, `from_schema`
- **Prefixes:** Editable key-value table of prefix → URI mappings, with "Add prefix" button and common prefix suggestions (linkml, owl, rdf, rdfs, xsd, skos, schema)
- **Default settings:** `default_prefix`, `default_range`, `default_curi_maps`
- **Imports:** Ordered list of imported schemas (file paths or URIs), with add/remove and drag-to-reorder

---

## 7. Core Workflows

### 7.1 Create New Project
1. User clicks "New Project"
2. Dialog: project name, root directory (platform file picker), root schema name and base URI
3. App creates directory structure, writes starter `{name}.yaml` with minimal valid LinkML header
4. Opens canvas with empty schema

### 7.2 Open Existing Project
1. User clicks "Open Project" → selects directory
2. App scans for `.yaml` files, parses each with js-yaml
3. Runs structural validation on each; reports errors non-blocking (file opens with warning badge)
4. Loads `.layout.json` sidecars if present; otherwise runs auto-layout (dagre or elk)
5. Renders canvas; opens most recently used schema file

### 7.3 Add a Class
1. Double-click empty canvas → "Add Class" quick menu, OR drag from palette
2. New node appears at click location with editable name field focused
3. User types name, hits Enter → class added to store, YAML dirty
4. Properties panel shows class editor

### 7.4 Add a Slot / Attribute
1. Click `[+ add slot]` in class node footer, OR click "Add Attribute" in Properties panel
2. Inline editing in node: type slot name, tab to range selector
3. Range selector: type-ahead dropdown showing all types, classes, enums in scope
4. If range is a class → edge automatically drawn to target node
5. Full slot properties available in Properties panel (right side)

### 7.5 Define Inheritance
1. Click the inheritance handle on a class node (top-center)
2. Drag to parent class → edge drawn
3. OR: set `is_a` in Properties panel dropdown
4. Single inheritance only; UI prevents setting a second `is_a` (prompts to convert to mixin instead)

### 7.6 Define a Mixin
1. Mark a class as `mixin: true` in Properties panel
2. Other classes can then add it via the "Mixins" multi-select in their Properties panel
3. Mixin edges rendered as dashed lines

### 7.7 Define an Enumeration
1. Drag "Enum" from palette, or right-click canvas → "Add Enum"
2. Enum node appears; click `[+ add value]` to add permissible values inline
3. Each value can have an optional `meaning` URI (ontology binding), editable in Properties panel
4. Slots with `range: MyEnum` draw an edge to the enum node

### 7.8 Export YAML
1. User presses Cmd/Ctrl+S or clicks "Save"
2. App serializes each `LinkMLSchema` to YAML via the serializer (Section 5.2)
3. Validation runs; errors shown in a non-blocking toast with detail panel
4. File written to disk via `PlatformAPI.writeFile`
5. Layout sidecar written alongside
6. Git status updates if Git enabled

### 7.9 Git Commit & Push
1. Git panel (accessible via status bar badge or View menu) shows:
   - Current branch
   - Changed files with diff summary
   - Commit message text field
   - "Stage all" / per-file stage checkboxes
   - "Commit" and "Commit & Push" buttons
2. App calls `PlatformAPI.gitCommit` / `gitPush`
3. Results shown in Git panel log
4. If Git not available: Git panel is hidden; no Git UI surfaces

### 7.10 Load Existing LinkML YAML (Import)
1. File → Open Schema, or drag `.yaml` file onto canvas
2. App parses YAML → `LinkMLSchema`
3. Validation: unknown slot properties stored in `extras` (not discarded)
4. Auto-layout applied if no sidecar present
5. Canvas renders; user can immediately edit

---

## 8. Slot Editor — Property Tiers

The slot property editor in the Properties panel is organized into two tiers to avoid overwhelming users. Recognized fields are fully editable; unknown slot properties are carried opaquely in `extras` to preserve them through the round-trip.

### Tier 1: Common Properties (always visible)

| Property | UI Control | Notes |
|---|---|---|
| `name` | Text input | Validated: no spaces, snake_case suggested |
| `description` | Textarea | |
| `range` | Searchable dropdown | Classes, enums, types in scope |
| `required` | Toggle | |
| `recommended` | Toggle | |
| `multivalued` | Toggle | |
| `identifier` | Toggle | At most one per class; mutually exclusive with `required: false` |
| `inlined` | Toggle | Enabled only when range is a class |
| `inlined_as_list` | Toggle | Enabled only when inlined + multivalued |

### Tier 2: URI / Ontology Bindings (collapsed by default, labeled "Ontology Bindings")

| Property | UI Control |
|---|---|
| `slot_uri` | Text input (CURIE or URI) |
| `mappings` | Tag input (CURIEs) |
| `exact_mappings` | Tag input |
| `close_mappings` | Tag input |
| `broad_mappings` | Tag input |
| `narrow_mappings` | Tag input |
| `alias` | Text input |

### Tier 3: Advanced (v1.x — rendered as raw YAML key-value editor)

All properties stored in `extras` are shown in an expandable "Advanced (raw)" section as an editable YAML text area. This ensures no data loss for schemas that use advanced properties (e.g., `symmetric`, `transitive`, `inverse`, `domain_of`, `ifabsent`) while deferring full UI controls to later versions.

---

## 9. Validation

### 9.1 Inline Validation
- Class names: must be PascalCase (warning, not error)
- Slot names: must be snake_case (warning)
- `is_a` target must exist in scope (error)
- `range` target must exist in scope or be a known built-in type (error)
- Circular inheritance: detected and flagged (error)
- Missing required schema metadata (`id`, `name`, `default_prefix`): warning

### 9.2 Validation Panel
Errors and warnings from structural validation are shown in a Validation panel with:
- Severity (error / warning)
- Location (class name, slot name)
- Message
- "Jump to" link that selects the offending node on canvas

### 9.3 Non-Blocking Policy
Validation errors **never prevent saving**. The user is warned but can always write the file. This matches the YAML-editing experience and avoids blocking researchers mid-work.

---

## 10. Auto-Layout

When opening a schema with no layout sidecar, the app auto-positions nodes using a hierarchical layout algorithm.

- **Library:** `elkjs` (Eclipse Layout Kernel, JS port) — handles hierarchical, layered layouts well-suited to class inheritance trees
- **Algorithm:** `layered` (ELK's Sugiyama-style) with top-to-bottom direction
- **Grouping:** Inheritance chains are laid out vertically; unrelated classes are arranged in a grid
- User can trigger "Auto Layout" at any time from the View menu (non-destructive: positions reset, user can undo)

---

## 11. Multi-Schema Projects and Imports

- Each schema file in a project is independently editable
- The canvas can show **one schema at a time** (the "active" schema)
- Classes from *imported* schemas appear on canvas as **read-only ghost nodes** (dimmed, different border style) to show relationship context
- Ghost nodes cannot be edited; clicking them opens the source schema file
- The Project Panel shows the import graph as a tree
- When adding a `range` that resolves to a class in an imported schema, the app automatically adds the correct `imports` entry to the active schema

---

## 12. Git Integration

### Detection
On startup, `PlatformAPI` attempts to detect Git availability:
- **Electron:** checks for `.git` directory in project root using Node `fs`
- **Web:** always uses isomorphic-git with OPFS; "Git available" is always true but remote push requires credential configuration

### Credential Handling
- Credentials (username/token for HTTPS remotes) are stored in the OS keychain (Electron: `keytar`) or in-memory only (web)
- SSH key auth is out of scope for v1.0

### UI
- Status bar shows: branch name, `↑N` (commits ahead), dirty file count
- Git panel (side drawer): staged files, unstaged files, commit message, commit/push buttons, log of last 20 commits
- Auto-stage on save is opt-in (project setting)

---

## 13. Persistence

### Web
- Projects stored in **Origin Private File System (OPFS)** via File System Access API
- Recent projects list stored in `localStorage`
- Export always available via "Download" (triggers browser file download)

### Electron
- Projects stored on the real filesystem in user-chosen directories
- Recent projects list in `~/.linkml-editor/recents.json`
- Full native file dialog integration

### Project File Format
Each project has a lightweight manifest alongside the schema files:

```yaml
# .linkml-editor.yaml  (in project root)
name: My Project
version: "1"
schemas:
  - path: schema/core.yaml
    prefix: myproject
  - path: schema/types.yaml
    prefix: myproject_types
rootSchema: schema/core.yaml
git:
  remoteUrl: https://github.com/org/repo
  defaultBranch: main
```

---

## 14. Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Save active schema | Cmd/Ctrl+S |
| Save all | Cmd/Ctrl+Shift+S |
| Add class | N |
| Add enum | E |
| Delete selected | Delete / Backspace |
| Undo | Cmd/Ctrl+Z |
| Redo | Cmd/Ctrl+Shift+Z |
| Fit canvas to content | Cmd/Ctrl+Shift+F |
| Focus selected nodes | F |
| Exit focus mode | Escape |
| Open schema settings | Cmd/Ctrl+, |
| Open Git panel | Cmd/Ctrl+G |
| Toggle Project panel | Cmd/Ctrl+B |
| Toggle Properties panel | Cmd/Ctrl+P |
| Search classes/slots | Cmd/Ctrl+K |

---

## 15. Extensibility Hooks (for v1.x)

The architecture should accommodate the following planned extensions without major refactoring:

1. **Full slot metamodel:** Tier 3 "Advanced" raw YAML editor is a placeholder. Future versions replace it with typed form controls for each advanced property. The `extras` field on `SlotDefinition` ensures round-trip safety until then.

2. **Downstream generators:** A `GeneratorPlugin` interface should be stubbed. Generators receive a `LinkMLSchema` object and return a string. The UI would add a "Generate" menu populated by registered plugins.

3. **Bidirectional YAML sync:** A split-pane mode with a Monaco YAML editor synchronized to the canvas state. The architecture's clean separation of store → canvas and store → YAML makes this additive.

4. **Schema-level slots:** v1.0 uses inline `attributes` only. v1.x adds schema-level `slots` with `domain` / `domain_of`. The data model already includes these fields.

5. **Collaborative editing:** Zustand store can be adapted to use a CRDT backend (e.g., Yjs) without changing component code if state mutations are kept in store actions.

---

## 16. Open Questions for Implementers

The following decisions are intentionally left to the implementation team:

1. **Node palette design:** Sidebar drag-to-canvas palette vs. context menu only vs. both — implement whichever feels more natural in ReactFlow.
2. **Undo/redo scope:** Per-schema or global. Recommend per-schema with a shared undo stack per open file, using `zundo` (Zustand undo middleware).
3. **Theme:** Light/dark mode toggle. shadcn/ui supports this natively — implement from day one.
4. **Auto-layout trigger:** Whether to auto-layout on every new import or only on explicit user action. Recommend: auto on first load only, manual thereafter.
5. **Prefix/CURIE resolution in range dropdowns:** Whether to show CURIEs or resolved URIs in the range selector. Recommend: show local name with CURIE as tooltip.

---

## 17. Acceptance Criteria (v1.0)

The following scenarios must pass for v1.0 release:

| # | Scenario |
|---|---|
| AC-01 | User creates a new project, defines 3 classes with attributes and inheritance, exports valid LinkML YAML that passes `linkml-validate` |
| AC-02 | User opens an existing LinkML YAML file (e.g., the `personinfo` example schema from the LinkML repo), canvas renders all classes with correct relationships |
| AC-03 | User adds ontology mappings to a slot (`exact_mappings: [skos:exactMatch]`), exports YAML, reloads — mappings preserved |
| AC-04 | User defines an enum, assigns it as the range of a slot, edge drawn to enum node, exports valid YAML |
| AC-05 | User activates focus mode on a subset, non-member nodes dim, edits to focused nodes work normally |
| AC-06 | User opens a schema with unknown slot properties (uses `extras`) — properties preserved in round-trip export |
| AC-07 | On a system with Git: user commits changed schema files with a message, push succeeds to remote |
| AC-08 | On a system without Git: no Git UI surfaces, app functions fully |
| AC-09 | Web build and Electron build open the same project directory and produce identical YAML output |
| AC-10 | Multi-file project: classes from imported schema appear as read-only ghost nodes |

---

*End of specification — v1.0-draft*
