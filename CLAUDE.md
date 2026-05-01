# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LinkML Visual Schema Editor — a cross-platform (web + Electron) graphical tool for authoring LinkML schemas on an ERD-style canvas. Monorepo managed with pnpm workspaces.

## Commands

```bash
# Development
pnpm dev                  # Web dev server (localhost:5173)
pnpm build                # Build core + web packages (Electron excluded; use build:all for desktop)
pnpm test                 # Run all Vitest tests
pnpm lint                 # ESLint across all packages
pnpm format               # Prettier formatting

# Single-package work
pnpm --filter @linkml-editor/core test        # Run only core tests
pnpm --filter @linkml-editor/core test:watch  # Watch mode for core tests

# Electron development (requires two terminals)
# Terminal 1: pnpm dev
# Terminal 2: pnpm --filter @linkml-editor/electron build && npx electron packages/electron/dist/main.js

# Electron packaging
pnpm --filter @linkml-editor/electron package          # All platforms
pnpm --filter @linkml-editor/electron package:linux    # Linux only

# Documentation (VitePress)
pnpm docs:dev
pnpm docs:build
```

## Architecture

### Monorepo Layout (4 packages)

- **`packages/core`** — Platform-agnostic shared library. Contains all React components, Zustand state, LinkML model, YAML I/O, validation, and canvas rendering. This is where most development happens.
- **`packages/web`** — Vite web build harness. Provides `WebPlatform` (File System Access API + isomorphic-git over OPFS) and the app entry point (`main.tsx`).
- **`packages/electron`** — Electron main process. Provides IPC handlers implementing PlatformAPI via Node.js fs + isomorphic-git. Preload script bridges to renderer.
- **`packages/docs`** — VitePress documentation site.

### Platform Abstraction

The `PlatformAPI` interface (`packages/core/src/platform/PlatformContext.ts`) defines file I/O and git operations. Two implementations exist:
- `WebPlatform` (`packages/web/src/platform/WebPlatform.ts`) — browser APIs + isomorphic-git/lightning-fs
- `ElectronPlatform` (`packages/web/src/platform/ElectronPlatform.ts`) — thin IPC bridge to electron main process

The active platform is provided via React context. All file/git operations go through this abstraction.

### State Management

Zustand store (`packages/core/src/store/index.ts`) composed of 6 slices: Project, Canvas, Editor, Git, UI, Validation. Undo/redo via zundo middleware (tracks schema state only, 50-item history).

### Key Modules in Core

- **`model/`** — TypeScript types mirroring LinkML metamodel (ClassDefinition, SlotDefinition, EnumDefinition, etc.)
- **`io/yaml.ts`** — YAML round-trip parsing/serialization. Preserves unknown fields via `extras` map.
- **`io/importResolver.ts`** — Resolves LinkML `imports:` directives, builds dependency graph.
- **`canvas/`** — ReactFlow canvas: custom ClassNode/EnumNode, ELK-based auto-layout (`autoLayout.ts`), schema-to-graph derivation (`deriveGraph.ts`).
- **`editor/`** — Properties panel, project panel, validation panel.
- **`validation/`** — Schema validation producing errors and warnings.

### Electron Build

Electron bundles the web dist as `extraResources` and serves it via a custom `app://` protocol (not `file://`). The electron-builder config is in `packages/electron/package.json`.

## Tech Stack

- React 18, TypeScript 5.4, Vite 5, Vitest (jsdom)
- ReactFlow 11 (canvas), Zustand 4 (state), js-yaml (YAML), elkjs (auto-layout)
- shadcn/ui (Radix + Tailwind) for UI primitives
- isomorphic-git + lightning-fs (browser git), keytar (desktop credentials)
- Electron 30, electron-builder 25

## Requirements

- Node.js >= 20.0.0
- pnpm >= 9.0.0
