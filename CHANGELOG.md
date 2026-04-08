# Changelog

## [0.4.1] - 2026-04-08

### Added

- **Help**: App version number now displayed in the Help > About dialog

## [0.4.0] - 2026-04-08

### Added

- **Git Panel**: Revert (discard) individual file changes directly from the Git panel — each unstaged file now shows a ↺ button, and a "Revert all" button discards all unstaged changes at once; both prompt for confirmation before executing

## [0.3.2] - 2026-04-08

### Added

- **Editor**: Rules block support for classes in the properties panel
- **Canvas**: Inherited slots now displayed on class nodes

## [0.3.1] - 2026-04-08

### Added

- **Editor**: Mixins field in the class properties panel for assigning mixin classes

### Fixed

- **Editor**: Restored "Delete attribute" label in the attributes panel (was previously blank)

## [0.3.0] - 2026-04-08

### Added

- **Editor**: Schema-level slot definitions with full UI — create, edit, and delete slots at the schema level; slots display in a dedicated panel with badge indicators on class nodes
- **Editor**: Attribute and slot names are now editable inline after creation
- **Editor**: Prefixes section in the schema properties panel for managing namespace prefix declarations
- **Help**: Driver.js guided tours accessible from the Help menu to walk users through key editor workflows

### Fixed

- **Deployment**: nginx `try_files` fallback now uses a `BASE_PATH`-relative path for correct SPA routing when deployed under a sub-path
- **Tests**: Restored passing test suite after driver.js and localStorage regressions

## [0.2.0] - 2026-04-07

### Added

- **Git panel**: Initialize a git repo from the UI, set remote URL, configure author name/email, store GitHub username and token credentials persistently
- **Git panel**: Auto-populate remote URL, author name, and email from the existing git config when opening settings
- **Cross-schema imports**: Schema properties panel now has an Imports section for adding local file and URL imports with live resolution
- **Cross-schema imports**: Range and `is_a` dropdowns include entities from imported schemas; connecting to a ghost node or selecting a cross-schema value automatically adds the required import
- **Canvas**: Ghost nodes (imported entities referenced by the active schema) are now draggable; their positions are persisted in `.linkml-editor.yaml`
- **Canvas**: Imported entity groups are collapsible via click and draggable as a unit using ReactFlow parent-child nodes
- **Canvas**: Entity search panel with instant filtering, accessible via the 🔍 button in the project panel header
- **Canvas**: Range and `is_a` dropdowns are filterable by typing
- **Project panel**: Split into two sections — local schema files (top) and a collapsible Imports section (bottom) listing transitively imported schemas
- **Project panel**: Clicking an imported schema opens it in the canvas in read-only mode; add/delete/connect operations and context menus are disabled; a "Read Only" banner is shown
- **Properties panel**: Shows a read-only notice when the active schema is an imported schema
- **Canvas layout**: Canvas positions and schema visibility are persisted to `.linkml-editor.yaml` for all schemas (local and imported)
- **New Schema dialog**: Create a blank YAML schema file within an open project
- **Schema file import**: Import an existing YAML file into the current project via the File menu
- **Project switcher**: Switch between recent projects without returning to the splash screen
- **Git pull**: Pull latest changes for URL-linked (cloned) projects
- **Git clone**: Friendly error messages for common failure cases (auth, not found, network)
- **Deployment**: `packages/proxy` — self-contained CORS proxy wrapping `@isomorphic-git/cors-proxy` for browser git operations; configurable via `PORT` and `ALLOW_ORIGIN` env vars
- **Deployment**: `deploy/web` — Docker Compose recipe with nginx (SPA routing + `/cors-proxy/` reverse proxy) and the proxy service; `VITE_GIT_CORS_PROXY` build-time env var to point at any proxy

### Fixed

- **Cross-schema**: `is_a` and range values referencing entities in other loaded schemas now automatically add the missing import to the active schema
- **Cross-schema**: URL-sourced imported schema paths were being mangled by the relative import helper; URL schemas are now returned as-is
- **Canvas**: Ghost nodes were not appearing for classes that referenced imported entities via `is_a`
- **Canvas**: Ghost node visibility and entity search result ordering improved (sorted by reference frequency)
- **Canvas**: `is_a` and range dropdowns now populate from all schemas in the project, not just the active one
- **Electron**: Credential key mismatch caused 401 Unauthorized on git push and pull; fixed to match the key written by `storeCredential`
- **Electron**: Missing `PlatformAPI` methods (`gitCreateRepo`, `gitSetRemote`, `gitReadConfig`) implemented in the Electron main-process platform
- **Web**: Buffer polyfill alias added to Vite config to fix Windows Electron build failures
- **Web**: Project title in the panel header showed the full directory path on Windows; now shows only the directory name on all platforms
- **Web**: "Open Project" from the splash page now correctly returns to the splash on cancel; Electron project storage path corrected
- **Web**: Git availability flag in the store was not set after clone or open-project
- **Web**: `onNewProject` and `onOpenProject` callbacks in `MenuBar` were not wired up

## [0.1.3] - 2026-04-03

### Added

- **Editor**: Show imported schema classes and enums in range slot dropdown

### Fixed

- **Canvas**: Change multi-select modifier key from Ctrl to Shift
- **Canvas**: Group imported schema classes in collapsible containers to prevent overlap

## [0.1.2] - 2026-04-02

### Fixed

- **Electron**: Serve web assets via custom `app://` protocol instead of `file://`. ES module scripts are blocked by Chromium's CORS policy when loaded from `file://` URLs, which caused the blank page on all platforms. The custom protocol is registered as privileged with full CORS and fetch API support.

## [0.1.1] - 2026-04-02

### Fixed

- **Electron**: Use relative asset paths (`./assets/...`) for `file://` protocol compatibility. The packaged Electron app was showing a blank page because Vite generated absolute asset paths that resolve to the filesystem root under the `file://` protocol.

## [0.1.0] - 2026-03-31

Initial release of LinkML Modeler as a desktop application.

### Added

- Visual schema editor with drag-and-drop class and enum creation
- Canvas-based editing with ReactFlow
- YAML round-trip parsing and serialization for LinkML schemas
- Edge attribute editing for range-edge slot properties
- Git integration (status, stage, commit, push) via isomorphic-git
- Electron desktop packaging for Linux, macOS, and Windows
- MIT license
