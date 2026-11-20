// A field made in a newer version of liveplanner (docs/specs/026-plan/item-types.md "Fields from a newer version"),
// re-exported from ./plan: the card panel shows it read-only with the line saying why, and the notice at the foot of
// the screen offers the reload that clears it. The labels are the editor's own (NewerFieldValue, NewVersionPrompt).

import { Scene, Label } from '@liveworkspace/help-site/art/primitives';

/** A card's newer field, read-only, and "A new version of liveplanner is ready" with Reload. */
export function PlanNewerFieldScene() {
  return (
    <Scene w={420} h={220} bg="plain">
      <rect
        x={10}
        y={10}
        width={400}
        height={150}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      <Label x={24} y={38} size={14} weight={700} tone="strong">
        Plan the launch event
      </Label>
      {/* An ordinary field, editable. */}
      <Label x={24} y={66} size={10} weight={600} tone="body">
        Due Date
      </Label>
      <rect
        x={120}
        y={56}
        width={276}
        height={18}
        rx={4}
        className="fill-white stroke-slate-300"
        strokeWidth={0.75}
      />
      <Label x={128} y={68} size={10} tone="body">
        Fri 28 Nov
      </Label>
      {/* The newer field: its value as plain text, a lock and the line saying why. */}
      <Label x={24} y={96} size={10} weight={600} tone="body">
        Venue Score
      </Label>
      <path
        d="M106 90h7v6h-7ZM107.5 90v-1.5a2 2 0 0 1 4 0V90"
        fill="none"
        className="stroke-slate-400"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x={120} y={86} width={276} height={18} rx={4} className="fill-slate-50" />
      <Label x={128} y={98} size={10} tone="muted">
        8 out of 10
      </Label>
      <Label x={120} y={120} size={9.5} tone="muted">
        Made in a newer version of liveplanner. Reload to edit it.
      </Label>
      <line x1={24} y1={136} x2={396} y2={136} className="stroke-slate-100" strokeWidth={1} />
      <Label x={24} y={150} size={9} tone="muted">
        Everything else on the card works as usual.
      </Label>
      {/* The notice at the foot of the screen. */}
      <rect x={24} y={172} width={372} height={38} rx={10} className="fill-slate-800" />
      <Label x={38} y={195} size={11} weight={600} className="fill-white">
        A new version of liveplanner is ready
      </Label>
      <rect x={266} y={180} width={50} height={22} rx={6} className="fill-brand-600" />
      <Label x={291} y={195} size={10} weight={600} anchor="middle" className="fill-white">
        Reload
      </Label>
      <Label x={352} y={195} size={10} anchor="middle" className="fill-slate-300">
        Not now
      </Label>
    </Scene>
  );
}
