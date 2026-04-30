# Accessibility Audit

**Date:** 2026-04-30  
**Scope:** LinkML Visual Schema Editor web app — both dark and light themes  
**Target:** WCAG 2.1 Level AA

---

## Contrast Audit (AC-B14)

### Method

Manual calculation using the WCAG relative luminance formula. Key token pairs inspected in both themes.

### Failures found and fixed

| Token | Theme | Use | Background | Ratio (before) | Ratio (after) | Status |
|---|---|---|---|---|---|---|
| `--color-fg-muted` | Light | Body text, labels | `--color-bg-canvas` (#f8fafc) | 2.47:1 ❌ | 4.57:1 ✅ | **Fixed** — changed `#94a3b8` → `#64748b` |
| Warning severity badge | Dark+Light | `WRN` badge text | `--color-state-warning` | ~1.7:1 ❌ | ~11:1 ✅ | **Fixed** — use `--color-state-warning-on` (dark text) |

### Passing tokens

| Token | Theme | Ratio | Notes |
|---|---|---|---|
| `--color-fg-primary` | Light | >12:1 | #0f172a on #f8fafc |
| `--color-fg-secondary` | Light | 7.42:1 | #475569 on #f8fafc |
| `--color-fg-muted` | Light | 4.57:1 | **Fixed** — see above |
| `--color-fg-primary` | Dark | >12:1 | #e2e8f0 on #0f172a |
| `--color-fg-secondary` | Dark | ~5.5:1 | #94a3b8 on #0f172a |
| `--color-fg-muted` | Dark | 3.74:1 | #64748b on #0f172a — passes for large/UI text (3:1), borderline for body |
| `--color-accent-default` | Light | 4.8:1 | #2563eb on white |
| `--color-accent-default` | Dark | 4.6:1 | #3b82f6 on #0f172a |

### Known borderline

- `--color-fg-muted` in **dark mode** (3.74:1 on canvas): meets the 3:1 large text / UI component threshold but not 4.5:1 for normal body text. Most uses of `--color-fg-muted` are for decorative / secondary labels (10–11px uppercase). Flagged for future tightening; not blocking.

---

## Form Input Associations (AC-B15)

### Method

Code audit of all `FieldRow`, `TextInput`, `TextArea`, `Checkbox`, and `FilteredGroupedSelect` components.

### Findings

| Component | Status | Notes |
|---|---|---|
| `Checkbox` | ✅ Already compliant | Input wrapped inside `<label>` |
| `FieldRow` + `TextInput` | **Fixed** | Added React context (`FieldRowIdContext`) with `React.useId()`; `FieldRow` sets `htmlFor`, `TextInput` reads context for `id` |
| `FieldRow` + `TextArea` | **Fixed** | Same pattern as `TextInput` |
| `FilteredGroupedSelect` | ⚠️ Not yet wired | Uses a custom combobox; label association needs `aria-labelledby` — deferred |

### Implementation

`FieldRow.tsx` now provides a stable generated id via context (`useFieldId()` hook). `TextInput` and `TextArea` read this id automatically; no changes to call sites required.

---

## Real Button Elements (AC-B16)

### Audit results

| Location | Pattern | Status |
|---|---|---|
| `SplashPage` recent-project rows | `div` with `onClick` | **Fixed in PTS-95** — converted to `<li>` + `<button>` |
| `ValidationPanel` collapsed bar | `div` with `onClick` | **Fixed** — converted to `<button>` |
| `MenuBar` dropdown trigger | `<button>` | ✅ Already compliant |
| `MenuBar` menu items | `<button>` | ✅ Already compliant |
| `ProjectPanel` tree items | Needs audit | Not yet reviewed |
| `Canvas` node click handlers | ReactFlow-managed | Not a plain `div onClick`; uses ReactFlow's selection system |

---

## Keyboard Navigation

### Splash page

- Tab order: logo → action buttons → footer links → theme toggle → recent projects
- Recent project trigger buttons: Enter/Space activates; Tab moves to remove button then next item
- Remove button becomes pointer-events-none when not hovered, but remains keyboard-focusable via `:focus-visible` override in CSS

### Menu bar

- Already has full keyboard navigation (ArrowUp/Down/Enter/Escape) — implemented in `DropdownMenu`
- View menu now contains theme toggle items

### Properties panel

- Tab moves through `FieldRow` inputs; `label[htmlFor]` association now correct

### Validation panel

- Collapsed bar is now a `<button>` — Tab-focusable and activatable via Enter/Space
- Filter buttons: ✅ already `<button>` elements

### Canvas

- ReactFlow provides its own keyboard navigation for node selection
- Tab/arrow navigation within the canvas is ReactFlow-managed

---

## Skip Link (AC-B17)

Added a `.lme-skip-link` anchor as the first focusable element in the main editor layout (project view only). It targets `#lme-canvas-area`.

- Hidden off-screen via `left: -9999px` by default
- Revealed at `left: 4px` on `:focus`
- Styled with surface background + focus-ring border

**Note:** The splash page does not have a skip link — it has no distinct "main content" region to skip to.

---

## Accessibility Docs

### User guide section — Keyboard Shortcuts

See the [Keyboard Shortcuts](./user-guide.md#keyboard-shortcuts) section of the user guide.

| Key | Action |
|---|---|
| Tab | Move focus to next interactive element |
| Shift+Tab | Move focus to previous interactive element |
| Enter / Space | Activate focused button |
| Escape | Close open menu or dialog |
| Ctrl+S | Save project |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Delete | Delete selected canvas node |
| F | Fit canvas view |
| Arrow keys | Navigate menu items when a menu is open |

---

## Remaining Items (future work)

| ID | Issue | Priority |
|---|---|---|
| AC-B15b | `FilteredGroupedSelect` needs `aria-labelledby` | Medium |
| AC-future | `ProjectPanel` tree items — audit for div-onClick | Low |
| AC-future | `--color-fg-muted` dark mode (3.74:1) — raise to 4.5:1 | Low |
| AC-future | Add `role="region"` + `aria-label` to canvas, properties, validation panels | Low |
| AC-future | Announce validation results to screen readers via `aria-live` | Low |
