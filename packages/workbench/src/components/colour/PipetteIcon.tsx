import { Glyph } from '@liveworkspace/ui';

// A pipette: the tool that lifts a colour off something already there.
export function PipetteIcon() {
  return (
    <Glyph size={14} units={24}>
      <path d="m2 22 1-1h3l9-9" />
      <path d="M3 21v-3l9-9" />
      <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.9.9a1 1 0 0 1 0 1.4l-1.4 1.4a1 1 0 0 1-1.4 0L11.3 8.1a1 1 0 0 1 0-1.4l1.4-1.4a1 1 0 0 1 1.4 0L15 6z" />
    </Glyph>
  );
}
