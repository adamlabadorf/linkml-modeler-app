# Changelog

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
