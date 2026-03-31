/**
 * Electron main process stub.
 *
 * Full platform harness (ElectronPlatform implementing PlatformAPI) is
 * implemented in Milestone 7.
 */

// Type-only import to keep main process free of renderer bundling issues
// import type { PlatformAPI } from '@linkml-editor/core';

console.log('LinkML Visual Schema Editor — Electron main process (stub)');

// In the full implementation:
// 1. Create a BrowserWindow loading packages/web/dist/index.html
// 2. Register IPC handlers that bridge ElectronPlatform <-> renderer
// 3. Detect .git in project root and report gitAvailable to renderer
