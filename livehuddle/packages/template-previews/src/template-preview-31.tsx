import type { ReactElement } from 'react';
import type { TemplateKind } from '@livehuddle/templates';
import { Plant } from './template-preview-23';
import { Arrival } from './template-preview-24';
import { Blocks, Seats, site } from './template-preview-25';
import { Floor } from './template-preview-26';

// Group 31: the Document Room (Work Tracker 1427, docs/specs/012-collaboration/virtual-office-template.md "Document
// Room"), drawn as group 29 draws its rooms, in the template's own canvas px scaled onto the 80 x 50 tile: one room,
// the big wall screen lit with a page on it, and two rows of chairs facing it either side of the aisle. Its hover
// story: a character walks in at the door.

const CARPET = 'rgb(226 230 238)';
const BEZEL = 'rgb(31 41 55)';
const GLASS = 'rgb(241 245 249)';
const INK = 'rgb(148 163 184)';
const ACCENT = 'rgb(16 185 129)';

function documentRoom(): ReactElement {
  const s = site(1040, 1040);
  // The screen's panel, and three lines of a page on it.
  const [px, py, pw, ph] = [326, 60, 388, 236];
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      <Floor s={s} fill={CARPET} door={520} />
      <Blocks s={s} at={[[200, 4, 640, 400]]} fill={BEZEL} />
      <rect x={s.X(220)} y={s.Y(24)} width={s.L(600)} height={s.L(360)} rx="0.4" fill={GLASS} />
      <rect x={s.X(px)} y={s.Y(py)} width={s.L(pw)} height={s.L(40)} rx="0.3" fill={ACCENT} />
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={s.X(px)}
          y={s.Y(py + 90 + i * 56)}
          width={s.L(i === 2 ? pw * 0.6 : pw)}
          height={s.L(24)}
          rx="0.3"
          fill={INK}
        />
      ))}
      <rect
        x={s.X(px)}
        y={s.Y(py + ph)}
        width={s.L(pw * 0.4)}
        height={s.L(24)}
        rx="0.3"
        fill={INK}
      />
      <Blocks s={s} at={[[16, 4, 176, 128]]} fill="rgb(217 160 92)" />
      <Seats s={s} xs={[220, 305, 390, 626, 711, 796]} ys={[500, 704]} />
      <Plant x={s.X(64)} y={s.Y(960)} />
      <Plant x={s.X(970)} y={s.Y(960)} />
      <Arrival x={s.X(520)} y={s.Y(900)} />
    </svg>
  );
}

export function templatePreviewGroup31(kind: TemplateKind): ReactElement | null {
  return kind === 'document-room' ? documentRoom() : null;
}
