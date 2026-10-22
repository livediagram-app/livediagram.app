// One small glyph per flowchart step type (docs/specs/009-elements/flowchart.md "Step types"): the
// step's own silhouette, so a menu row or tile reads as the shape it makes. Shared by the step
// toolbar's Step Type menu and the Flowchart menu section.
import type { ReactNode } from 'react';
import type { FlowchartStepType } from '@liveplanner/project';
import { Glyph } from '@liveplanner/ui';

export const STEP_TYPE_GLYPH: Record<FlowchartStepType, ReactNode> = {
  terminator: (
    <Glyph size={16} units={16}>
      <rect x="1" y="4.5" width="14" height="7" rx="3.5" />
    </Glyph>
  ),
  process: (
    <Glyph size={16} units={16}>
      <rect x="1.5" y="4" width="13" height="8" rx="0.5" />
    </Glyph>
  ),
  decision: (
    <Glyph size={16} units={16}>
      <path d="M8 1.5 14.5 8 8 14.5 1.5 8z" />
    </Glyph>
  ),
  io: (
    <Glyph size={16} units={16}>
      <path d="M4 4h11l-3 8H1z" />
    </Glyph>
  ),
  document: (
    <Glyph size={16} units={16}>
      <path d="M1.5 3h13v8.5c-2.2-1.6-4.3-1.6-6.5 0s-4.3 1.6-6.5 0z" />
    </Glyph>
  ),
  database: (
    <Glyph size={16} units={16}>
      <ellipse cx="8" cy="3.5" rx="5.5" ry="2" />
      <path d="M2.5 3.5v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9" />
    </Glyph>
  ),
  preparation: (
    <Glyph size={16} units={16}>
      <path d="M4.5 3.5h7L14.5 8l-3 4.5h-7L1.5 8z" />
    </Glyph>
  ),
  connector: (
    <Glyph size={16} units={16}>
      <circle cx="8" cy="8" r="5" />
    </Glyph>
  ),
};
