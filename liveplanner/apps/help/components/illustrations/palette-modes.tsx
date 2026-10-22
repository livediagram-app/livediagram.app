// Palette-category illustrations (docs/specs/018-help/help-app.md): the mode picker (Select, Hand,
// Format Painter, Isometric) and the palette
// settings (Auto-Attach Arrows, Alignment Guides, Panel Opacity). Composed only from the shared primitives so the house style
// holds.

import { Scene } from './primitives';
import { IsoCard, iso } from './palette-modes-parts';
import { PickerTrigger } from './selection-modes';

// --- Mode scenes ------------------------------------------------------------

/** Isometric mode: the picker set to Isometric and the same shapes tilted into an
 *  isometric, three-dimensional view. */
export function IsometricMode() {
  const a = iso(-70, -30);
  const b = iso(70, 30);
  return (
    <Scene w={420} h={264}>
      <PickerTrigger tool="isometric" />
      <line
        x1={a[0]}
        y1={a[1] + 6}
        x2={b[0]}
        y2={b[1] + 6}
        className="stroke-brand-400"
        strokeWidth={2.5}
      />
      <IsoCard cx={-70} cy={-30} label="A" />
      <IsoCard cx={70} cy={30} accent label="B" />
    </Scene>
  );
}
