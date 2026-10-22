'use client';

// Where the Explorer runs (docs/specs/013-workspace/workbench-embeds.md "What renders", blueprint "The Explorer in
// a workbench"): the app, or a workspace frame inside a workbench. In the frame the Explorer is itself, its sidebar,
// views and empty states, without the app's surroundings: no app header, account menu or Settings, no sign-in
// banner, and none of the account's administration (API tokens, Teams administration, the guest migration).
import { useWorkbenchSession } from '@/components/providers/workbench-session-context';

export type ExplorerSurface = 'app' | 'workbench';

export type ExplorerSurfaceFlags = {
  // The brand, the product nav and the account menu across the top.
  appHeader: boolean;
  // Settings: its gear, its dialog and every link that opens it.
  settings: boolean;
  // The Appearance control: a workbench sets the scheme.
  appearance: boolean;
  // The sign-in nudge and the move of this browser's documents after signing in.
  guestPrompts: boolean;
  // API tokens (the timeline's token cards' Revoke) and Teams administration (New team, Invites, team settings).
  administration: boolean;
};

export function explorerSurfaceFlags(surface: ExplorerSurface): ExplorerSurfaceFlags {
  const app = surface === 'app';
  return {
    appHeader: app,
    settings: app,
    appearance: app,
    guestPrompts: app,
    administration: app,
  };
}

export function useExplorerSurface(): ExplorerSurface {
  return useWorkbenchSession()?.scope === 'workspace' ? 'workbench' : 'app';
}
