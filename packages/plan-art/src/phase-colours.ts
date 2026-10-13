// The phase colours, the same on either surface: they read as status, not as theme. Shared by the live views
// (view-frame.tsx) and their still pictures in an image export (lib/export-plan). Pure.
export const PHASE_COLOURS = {
  todo: '#94a3b8',
  doing: '#3b82f6',
  done: '#16a34a',
} as const;
export const OVERDUE_RED = '#dc2626';
