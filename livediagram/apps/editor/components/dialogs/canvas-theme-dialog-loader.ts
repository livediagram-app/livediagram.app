// The Tab Style dialog's code, loaded on its first open (EditorModals.tsx) or earlier by Watch It Built's Look and Feel
// (lib/replay/topics/diagram-look.ts `warm`). Once here the editor draws it directly, without the lazy wrapper: while
// a replay re-renders the editor on every frame, React's retry of a suspended lazy component was starved for seconds,
// so the dialog Open Style pressed for appeared ~3 s late.
import type { CanvasThemeDialog as Dialog } from './CanvasThemeDialog';

let loaded: typeof Dialog | null = null;

/** Loads the dialog's code, once; resolves to the component. */
export function loadCanvasThemeDialog(): Promise<typeof Dialog> {
  return import('./CanvasThemeDialog').then((m) => (loaded = m.CanvasThemeDialog));
}

/** The dialog when its code is here, else null. */
export const loadedCanvasThemeDialog = (): typeof Dialog | null => loaded;
