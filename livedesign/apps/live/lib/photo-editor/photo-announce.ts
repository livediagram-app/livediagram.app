// What a photo page says to a screen reader (docs/specs/031-photo/photo-tools.md "Accessibility"): each edit
// by its name, a stroke or a fill with the layer it landed on ("Brush on Layer 2"), and the selection's size
// as it changes ("Selection: 640 by 480"), through the canvas's live region (lib/announcer.ts).
import { maskBounds, type Mask8 } from '@livedesign/photo-engine';
import { announce } from '@liveworkspace/workbench/lib/announcer';
import type { PhotoSession } from './session';

// The edits made on one layer's pixels: said with the layer's name.
const ON_A_LAYER: ReadonlySet<string> = new Set([
  'Brush',
  'Pencil',
  'Eraser',
  'Background Eraser',
  'Clone Stamp',
  'Heal',
  'Spot Heal',
  'Red Eye',
  'Blur',
  'Sharpen',
  'Smudge',
  'Dodge',
  'Burn',
  'Sponge',
  'Fill',
  'Clear',
  'Gradient',
  'Paint Bucket',
  'Filter',
]);

/** An edit said as it commits. */
export function announceCommit(label: string, s: PhotoSession): void {
  const layer = s.layer(s.active);
  announce(ON_A_LAYER.has(label) && layer ? `${label} on ${layer.name}` : label);
}

export function selectionWords(m: Mask8 | null): string {
  const b = m ? maskBounds(m) : null;
  return b ? `Selection: ${b.width} by ${b.height}` : 'Deselected';
}

/** The selection's size said whenever it changes; answers the unsubscribe. */
export function watchSelection(s: PhotoSession): () => void {
  let was = s.selection;
  return s.subscribe(() => {
    if (s.selection === was) return;
    was = s.selection;
    announce(selectionWords(was));
  });
}
