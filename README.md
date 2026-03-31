# LinkML Visual Schema Editor

A cross-platform graphical tool for authoring, editing, and visualizing [LinkML](https://linkml.io/) schemas using an ERD-style canvas.

## Overview

- **Web app** — static build, deployable to any web server or GitHub Pages
- **Electron app** — desktop application using the same shared codebase

## Repository Structure

```
packages/
├── core/       # Shared React app (renderer) — canvas, editor, store, IO, model, UI
├── web/        # Vite web build harness
└── electron/   # Electron main process + harness
docs/
└── design-spec.md   # High-level design specification (v1.0-draft)
```

## Tech Stack

React 18 + TypeScript · ReactFlow · Zustand · js-yaml · shadcn/ui · Vite · isomorphic-git

## Documentation

See [docs/design-spec.md](docs/design-spec.md) for the full design specification.
