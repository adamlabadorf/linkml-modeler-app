# LinkML Visual Schema Editor

A cross-platform graphical tool for authoring, editing, and visualizing [LinkML](https://linkml.io/) schemas using an ERD-style canvas.

## Overview

- **Web app** — static build, deployable to any web server or GitHub Pages
- **Electron app** — desktop application using the same shared codebase

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20.0.0
- [pnpm](https://pnpm.io/) >= 9.0.0 (`npm install -g pnpm`)

### Install dependencies

```bash
pnpm install
```

### Run the web app (development)

```bash
pnpm dev
```

Opens at [http://localhost:5173](http://localhost:5173). Hot module replacement is enabled.

### Run the Electron desktop app (development)

In one terminal, start the web dev server:

```bash
pnpm dev
```

In a second terminal, build the Electron main process and launch it:

```bash
pnpm --filter @linkml-editor/core build
pnpm --filter @linkml-editor/electron build
NODE_ENV=development npx electron packages/electron/dist/main.js
```

The Electron window will load from the local dev server.

### Build for production

```bash
pnpm build
```

- **Web output:** `packages/web/dist/` — serve these static files from any web server.
- **Electron output:** `packages/electron/dist/main.js` — run with `npx electron packages/electron/dist/main.js` (bundles the web dist automatically).

## Repository Structure

```
packages/
├── core/       # Shared React app (renderer) — canvas, editor, store, IO, model, UI
├── web/        # Vite web build harness + platform adapter
├── electron/   # Electron main process + IPC handlers
└── docs/       # VitePress documentation site (deployed to GitHub Pages)
docs/
├── design-spec.md    # High-level design specification (v1.0-draft)
├── user-guide.md     # End-user guide
└── development.md    # Developer guide
```

## Tech Stack

React 18 + TypeScript · ReactFlow · Zustand · js-yaml · shadcn/ui · Vite · isomorphic-git

## Documentation

**[View the full documentation site](https://adamlabadorf.github.io/linkml-modeler-app/)**

| Document | Description |
|---|---|
| [User Guide](https://adamlabadorf.github.io/linkml-modeler-app/user-guide) | How to use the editor |
| [Developer Guide](https://adamlabadorf.github.io/linkml-modeler-app/development) | Developer setup, architecture, and contribution guide |
| [Design Spec](https://adamlabadorf.github.io/linkml-modeler-app/design-spec) | Full design specification |

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start web dev server (localhost:5173) |
| `pnpm build` | Build all packages for production |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint TypeScript/TSX source files |
| `pnpm format` | Format source files with Prettier |
