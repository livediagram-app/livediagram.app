import { Stage } from '@liveworkspace/help-site/art/parts';
import { WalkStrip } from '../illustrations/editor-chrome';
import { PixelCharacter } from '../illustrations/pixel-character';
import { Bookshelf, Plant, Room, Rug, Sofa } from '../illustrations/space-furniture';

// Edit | Walk: the strip with Walk on and the walker's own controls after it, and your character crossing the
// Lounge to the sofa, the path it walked dotted behind it.
export function SelectionModesArt() {
  return (
    <Stage>
      <Room x={40} y={58} w={320} h={148} name="Lounge" />
      <Rug cx={270} cy={140} rx={60} ry={28} />
      <Sofa x={248} y={122} />
      <Bookshelf x={70} y={70} />
      <Plant cx={340} cy={186} />
      <path
        d="M96 184 C 140 196, 190 170, 214 156"
        className="fill-none stroke-brand-500"
        strokeWidth={1.25}
        strokeDasharray="3 3"
        strokeLinecap="round"
      />
      <circle cx={96} cy={184} r={2.5} className="fill-brand-500" />
      <PixelCharacter fx={224} fy={164} px={1.8} shirt="brand" name="You" />
      <WalkStrip x={64} y={14} />
    </Stage>
  );
}
