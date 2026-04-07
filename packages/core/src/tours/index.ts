/**
 * Guided tour system using driver.js.
 *
 * Each tour is a named sequence of driver.js steps. Tours are triggered from
 * the Help menu in MenuBar and can be re-run at any time. Before starting a
 * tour, panels that the tour references are opened so their DOM elements exist.
 */
import { driver, type DriveStep, type Config } from 'driver.js';
import 'driver.js/dist/driver.css';

// ── Dark theme override for driver.js popovers ────────────────────────────────

const TOUR_STYLES = `
  .lme-tour-popover {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 8px;
    color: #e2e8f0;
    font-family: monospace;
    max-width: 320px;
    padding: 18px 20px 14px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.6);
  }
  .lme-tour-popover .driver-popover-title {
    font-size: 13px;
    font-weight: 700;
    color: #60a5fa;
    margin-bottom: 8px;
  }
  .lme-tour-popover .driver-popover-description {
    font-size: 12px;
    line-height: 1.65;
    color: #94a3b8;
  }
  .lme-tour-popover .driver-popover-description b {
    color: #e2e8f0;
    font-weight: 600;
  }
  .lme-tour-popover .driver-popover-description code,
  .lme-tour-popover .driver-popover-description kbd {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 11px;
    font-family: monospace;
    color: #e2e8f0;
  }
  .lme-tour-popover .driver-popover-navigation-btns {
    margin-top: 14px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .lme-tour-popover .driver-popover-prev-btn,
  .lme-tour-popover .driver-popover-next-btn,
  .lme-tour-popover .driver-popover-done-btn {
    background: #334155;
    border: 1px solid #475569;
    border-radius: 5px;
    color: #e2e8f0;
    cursor: pointer;
    font-family: monospace;
    font-size: 11px;
    padding: 5px 12px;
  }
  .lme-tour-popover .driver-popover-next-btn,
  .lme-tour-popover .driver-popover-done-btn {
    background: #1d4ed8;
    border-color: #2563eb;
    color: #fff;
    margin-left: auto;
  }
  .lme-tour-popover .driver-popover-prev-btn:hover { background: #475569; }
  .lme-tour-popover .driver-popover-next-btn:hover,
  .lme-tour-popover .driver-popover-done-btn:hover { background: #2563eb; }
  .lme-tour-popover .driver-popover-progress-text {
    font-size: 10px;
    color: #475569;
    font-family: monospace;
    margin-left: 4px;
  }
  .lme-tour-popover .driver-popover-close-btn {
    color: #475569;
    font-size: 16px;
    line-height: 1;
    position: absolute;
    top: 12px;
    right: 14px;
    background: transparent;
    border: none;
    cursor: pointer;
    font-family: monospace;
  }
  .lme-tour-popover .driver-popover-close-btn:hover { color: #94a3b8; }
  .driver-overlay { background: rgba(0,0,0,0.65) !important; }
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  const el = document.createElement('style');
  el.textContent = TOUR_STYLES;
  document.head.appendChild(el);
  stylesInjected = true;
}

// ── Shared popover config ─────────────────────────────────────────────────────

const BASE_CONFIG: Partial<Config> = {
  animate: true,
  smoothScroll: true,
  allowClose: true,
  overlayOpacity: 0.6,
  stagePadding: 6,
  stageRadius: 6,
  popoverClass: 'lme-tour-popover',
  nextBtnText: 'Next →',
  prevBtnText: '← Back',
  doneBtnText: 'Done',
  showProgress: true,
  progressText: '{{current}} of {{total}}',
};

// ── Tour: App Overview ────────────────────────────────────────────────────────

const overviewSteps: DriveStep[] = [
  {
    element: '#lme-logo',
    popover: {
      title: '⬡ LinkML Visual Schema Editor',
      description:
        'Welcome! This app lets you design LinkML schemas visually on an ERD-style canvas — no hand-editing YAML required. This tour will show you where everything lives.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '#lme-menubar',
    popover: {
      title: 'Menu Bar',
      description:
        'The menu bar gives you access to all file operations (<b>File</b>), undo/redo (<b>Edit</b>), panel toggles (<b>View</b>), git actions (<b>Git</b>), and these tours (<b>Help</b>).',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '#lme-project-panel',
    popover: {
      title: 'Project Panel',
      description:
        'The <b>Project Panel</b> on the left lists every schema file in your project. Click a file to make it active. Files marked <i>imported</i> are read-only references from another schema.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '#lme-canvas-area',
    popover: {
      title: 'Canvas',
      description:
        'The <b>canvas</b> is your visual workspace. Classes and enumerations appear as nodes. Scroll to zoom, drag empty space to pan, and press <kbd>F</kbd> to fit everything in view.',
      side: 'top',
      align: 'center',
    },
  },
  {
    element: '#lme-canvas-toolbar',
    popover: {
      title: 'Canvas Toolbar',
      description:
        'Use these buttons to <b>add a class</b>, <b>add an enum</b>, or <b>auto-layout</b> the diagram. You can also right-click anywhere on the canvas to get the same options.',
      side: 'left',
      align: 'start',
    },
  },
  {
    element: '#lme-focus-toolbar',
    popover: {
      title: 'Focus Mode Toolbar',
      description:
        'When working on large schemas, <b>Focus Mode</b> lets you isolate a subset or just the nodes you have selected — hiding everything else to reduce clutter.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '#lme-properties-panel',
    popover: {
      title: 'Properties Panel',
      description:
        'Click any node on the canvas to select it. The <b>Properties Panel</b> on the right will show its editable fields — name, description, slots, enums, inheritance, and more.',
      side: 'left',
      align: 'start',
    },
  },
  {
    element: '#lme-validation-panel',
    popover: {
      title: 'Validation Panel',
      description:
        'The <b>Validation Panel</b> at the bottom checks your schema for errors and warnings — missing ranges, invalid references, circular inheritance, and so on. Click it to expand.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '#lme-git-panel',
    popover: {
      title: 'Git Panel',
      description:
        'Next to Validation, the <b>Git Panel</b> lets you stage files, write commit messages, push to a remote, and view recent history — all without leaving the editor.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '#lme-footer',
    popover: {
      title: 'Status Bar',
      description:
        'The status bar shows the active file name, class/enum counts, any validation errors, and the latest git commit. Common keyboard shortcuts are listed on the right.',
      side: 'top',
      align: 'start',
    },
  },
];

// ── Tour: Project Panel ───────────────────────────────────────────────────────

const projectPanelSteps: DriveStep[] = [
  {
    element: '#lme-project-panel',
    popover: {
      title: 'Project Panel Overview',
      description:
        'The <b>Project Panel</b> shows every schema file that belongs to your project. A project is a folder that can contain multiple linked <code>.yaml</code> files.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '#lme-project-panel',
    popover: {
      title: 'Switching Active Schemas',
      description:
        'Click any file row to make that schema active. The canvas and Properties Panel will switch to show that file\'s classes and enums. Only one schema is active at a time.',
      side: 'right',
      align: 'center',
    },
  },
  {
    element: '#lme-project-panel',
    popover: {
      title: 'File Indicators',
      description:
        '<b>●</b> (orange dot) means the file has unsaved changes. The <b>◻</b>/<b>◼</b> icons show whether a schema is editable or read-only. Click the visibility dot to show or hide a schema on the canvas.',
      side: 'right',
      align: 'center',
    },
  },
  {
    element: '#lme-menubar',
    popover: {
      title: 'Adding & Importing Schemas',
      description:
        'Use <b>File → New Schema…</b> to create a blank schema file in your project, or <b>File → Import Schema…</b> to bring in an existing <code>.yaml</code> file. Imported schemas appear as read-only references.',
      side: 'bottom',
      align: 'start',
    },
  },
];

// ── Tour: Canvas & Workspace ──────────────────────────────────────────────────

const canvasSteps: DriveStep[] = [
  {
    element: '#lme-canvas-area',
    popover: {
      title: 'The Canvas',
      description:
        'This is your schema workspace. Classes appear as hexagon-bordered cards; enumerations appear in orange. Drag nodes to reposition them — positions are saved automatically.',
      side: 'top',
      align: 'center',
    },
  },
  {
    element: '#lme-canvas-add-class',
    popover: {
      title: 'Adding a Class',
      description:
        'Click <b>⬡ + Class</b> to add a new class to the canvas and schema. You can also right-click anywhere on the canvas background for the same option.',
      side: 'left',
      align: 'center',
    },
  },
  {
    element: '#lme-canvas-add-enum',
    popover: {
      title: 'Adding an Enumeration',
      description:
        'Click <b>◈ + Enum</b> to add a new enumeration. Enums hold a fixed list of permissible values and can be used as the range of a slot.',
      side: 'left',
      align: 'center',
    },
  },
  {
    element: '#lme-canvas-layout',
    popover: {
      title: 'Auto Layout',
      description:
        'Click <b>⬡ Layout</b> to automatically arrange all nodes using the ELK graph layout engine. Useful after adding many classes at once, or when the diagram gets cluttered.',
      side: 'left',
      align: 'center',
    },
  },
  {
    element: '#lme-canvas-area',
    popover: {
      title: 'Creating Relationships',
      description:
        'To create an <b>is_a</b> (inheritance) relationship, hover over a class node until small connection handles appear on its edges, then drag from one handle to another class.',
      side: 'top',
      align: 'center',
    },
  },
  {
    element: '#lme-canvas-area',
    popover: {
      title: 'Selecting & Deleting',
      description:
        'Click a node to select it. Hold <kbd>Shift</kbd> and click (or drag a rubber-band box) to select multiple. Press <kbd>Delete</kbd> or <kbd>Backspace</kbd> to remove selected nodes or edges.',
      side: 'top',
      align: 'center',
    },
  },
  {
    element: '#lme-focus-toolbar',
    popover: {
      title: 'Focus Mode',
      description:
        'Select one or more nodes, then click <b>⬡ Focus Selection</b> to hide everything else and concentrate on just those nodes and their neighbours. Use the subset dropdown to focus by LinkML subset tag.',
      side: 'bottom',
      align: 'start',
    },
  },
];

// ── Tour: Properties & YAML Preview ──────────────────────────────────────────

const propertiesSteps: DriveStep[] = [
  {
    element: '#lme-properties-panel',
    popover: {
      title: 'Properties Panel',
      description:
        'The <b>Properties Panel</b> is context-sensitive — its content changes based on what you select. With nothing selected it shows the active schema\'s metadata.',
      side: 'left',
      align: 'start',
    },
  },
  {
    element: '#lme-properties-panel',
    popover: {
      title: 'Editing a Class',
      description:
        'Click any class node on the canvas to select it. You can then edit its <b>name</b>, <b>description</b>, <b>is_a</b> parent, <b>mixins</b>, and toggle the <b>abstract</b> or <b>mixin</b> flags.',
      side: 'left',
      align: 'center',
    },
  },
  {
    element: '#lme-properties-panel',
    popover: {
      title: 'Managing Slots (Attributes)',
      description:
        'Slots are the fields of a class. In the Properties Panel you can add, rename, and delete slots, and configure each slot\'s <b>range</b> (type), <b>cardinality</b>, and identifier flags.',
      side: 'left',
      align: 'center',
    },
  },
  {
    element: '#lme-properties-panel',
    popover: {
      title: 'Editing an Enumeration',
      description:
        'Select an enum node to edit its name, description, and <b>permissible values</b>. You can also set optional meaning URIs for each value to link to ontology terms.',
      side: 'left',
      align: 'center',
    },
  },
  {
    element: '#lme-yaml-preview',
    popover: {
      title: 'YAML Preview',
      description:
        'The <b>YAML Preview</b> panel (far right) shows the exact YAML that will be written to disk when you save. It updates in real time as you edit. Toggle it via <b>View → YAML Preview</b>.',
      side: 'left',
      align: 'start',
    },
  },
];

// ── Tour: Validation ──────────────────────────────────────────────────────────

const validationSteps: DriveStep[] = [
  {
    element: '#lme-validation-panel',
    popover: {
      title: 'Validation Panel',
      description:
        'The <b>Validation Panel</b> checks your schema for structural problems. Click it to expand. Validation never blocks saving — errors are informational.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '#lme-validation-panel',
    popover: {
      title: 'Running Validation',
      description:
        'Click <b>▶ Validate</b> inside the panel to run a full check. The summary bar shows counts of <span style="color:#f87171">errors</span>, <span style="color:#fbbf24">warnings</span>, and info messages.',
      side: 'top',
      align: 'center',
    },
  },
  {
    element: '#lme-validation-panel',
    popover: {
      title: 'Filtering & Jumping',
      description:
        'Use the filter buttons (<b>Errors</b>, <b>Warnings</b>, <b>Info</b>) to narrow the list. Click <b>↗ jump</b> on any issue to select the offending class or slot on the canvas.',
      side: 'top',
      align: 'center',
    },
  },
  {
    element: '#lme-footer',
    popover: {
      title: 'Status Bar Summary',
      description:
        'Error and warning counts are also visible in the status bar at the bottom of the screen, so you always have a quick read on schema health without expanding the panel.',
      side: 'top',
      align: 'start',
    },
  },
];

// ── Tour: Git Workflow ────────────────────────────────────────────────────────

const gitSteps: DriveStep[] = [
  {
    element: '#lme-git-panel',
    popover: {
      title: 'Git Panel',
      description:
        'The <b>Git Panel</b> provides full version control from inside the editor. Click it to expand. Git is available when you open a folder that already has a git repository, or after cloning.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '#lme-git-panel',
    popover: {
      title: 'Changes Tab — Staging Files',
      description:
        'The <b>Changes</b> tab shows modified, untracked, and staged files. Check files to stage them, or use <b>Stage All</b> to stage everything at once.',
      side: 'top',
      align: 'center',
    },
  },
  {
    element: '#lme-git-panel',
    popover: {
      title: 'Committing',
      description:
        'Type a commit message in the text area and click <b>Commit</b> to create a new commit from your staged files. The <b>Log</b> tab shows recent commits with their hashes and timestamps.',
      side: 'top',
      align: 'center',
    },
  },
  {
    element: '#lme-git-panel',
    popover: {
      title: 'Pushing & Pulling',
      description:
        'Use <b>↑ Push</b> to send commits to your remote. If credentials are required, you\'ll be prompted securely. Use <b>↓ Pull</b> to fetch the latest from the remote.',
      side: 'top',
      align: 'center',
    },
  },
  {
    element: '#lme-git-panel',
    popover: {
      title: 'Settings Tab',
      description:
        'The <b>Settings</b> tab lets you configure the remote URL, author name, and email for this repository. Credentials are stored securely using the platform keychain.',
      side: 'top',
      align: 'center',
    },
  },
  {
    element: '#lme-menubar',
    popover: {
      title: 'Git Menu',
      description:
        'The <b>Git</b> menu in the menu bar provides quick shortcuts to open the panel for committing, pushing, and pulling without having to click the bottom tab.',
      side: 'bottom',
      align: 'start',
    },
  },
];

// ── Tour registry & launcher ──────────────────────────────────────────────────

export type TourId =
  | 'overview'
  | 'project-panel'
  | 'canvas'
  | 'properties'
  | 'validation'
  | 'git';

const TOURS: Record<TourId, DriveStep[]> = {
  overview: overviewSteps,
  'project-panel': projectPanelSteps,
  canvas: canvasSteps,
  properties: propertiesSteps,
  validation: validationSteps,
  git: gitSteps,
};

/**
 * Start a named tour. Panels that the tour requires are opened first so their
 * DOM elements are guaranteed to be mounted when driver.js highlights them.
 */
export function startTour(
  id: TourId,
  opts?: {
    /** Called to ensure a panel is open before the tour starts. */
    openValidationPanel?: () => void;
    openGitPanel?: () => void;
    openPropertiesPanel?: () => void;
    openYamlPreview?: () => void;
  }
): void {
  // Pre-open panels required by this tour so their elements are in the DOM.
  if (id === 'overview' || id === 'validation') {
    opts?.openValidationPanel?.();
  }
  if (id === 'overview' || id === 'git') {
    opts?.openGitPanel?.();
  }
  if (id === 'overview' || id === 'properties') {
    opts?.openPropertiesPanel?.();
  }
  if (id === 'properties') {
    opts?.openYamlPreview?.();
  }

  const steps = TOURS[id];

  // Inject dark theme CSS once, then drive.
  injectStyles();

  // Small delay so React can flush any state updates from the panel opens above.
  setTimeout(() => {
    const d = driver({ ...BASE_CONFIG, steps });
    d.drive();
  }, 80);
}
