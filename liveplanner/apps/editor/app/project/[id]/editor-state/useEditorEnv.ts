import { useWorkbenchProjectSession } from '@/components/providers/workbench-session-context';
import { surfaceFlags, type EditorSurface } from '@liveworkspace/workbench/lib/editor-surface';
import type { Tab } from '@liveplanner/project';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { createTab } from '../editor-page-helpers';

// Where the editor runs (the surface and its flags, a workbench's session) and who is signed in.
export function useEditorEnv(opts: { surface?: EditorSurface }) {
  // Where the editor runs (editor-surface.ts). The read-only embed view (docs/specs/013-workspace/
  // embeds.md) forces view behaviour regardless of the share role, suppresses the visitor identity
  // screen, and EditorView swaps the chrome for the embed badge + tab switcher. A workbench
  // (docs/specs/013-workspace/blueprints/workbench-embeds.md "The editor in a workbench") is signed in
  // by its session and drops the app's surroundings and everything beyond its one project.
  // Constant for the lifetime of the page (it comes from which route mounted us), so it's safe in
  // derived consts.
  const surface = opts.surface ?? 'app';
  const { embedMode, workbenchMode, appChrome } = surfaceFlags(surface);
  const workbench = useWorkbenchProjectSession();
  const initialTabs: Tab[] = [createTab('Tab 1')];

  // Embed page-view telemetry (docs/specs/013-workspace/embeds.md) is emitted by editor-page.tsx —
  // exactly one site, so an embed render can't be double-counted.

  // Sign-in wiring (token provider + guest→authed migration). One hook
  // does both — see `hooks/useAccountBootstrap.ts`. The values it
  // returns are the same ones `useAuth()` would; we read them via the
  // hook so the page has one source of truth.
  const { authLoaded, accountUserId, accountDisplayName } = useAccountBootstrap();
  return {
    accountDisplayName,
    accountUserId,
    appChrome,
    authLoaded,
    embedMode,
    initialTabs,
    surface,
    workbench,
    workbenchMode,
  };
}

export type EditorEnvSlice = ReturnType<typeof useEditorEnv>;
