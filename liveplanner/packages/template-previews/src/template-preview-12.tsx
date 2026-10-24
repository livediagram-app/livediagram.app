import type { ReactElement } from 'react';
import type { TemplateKind } from '@liveplanner/templates';

// Group 12: Blank Tab (docs/specs/026-plan/plan-templates.md "The blanks"). Static SVG preview tiles (one branch per
// TemplateKind; see template-preview.tsx for who renders them); TemplatePreview chains the groups with ??.

export function templatePreviewGroup12(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'blank':
      // Blank Tab: an empty canvas on a faint dot grid, nothing on it yet (Start Planning offers what goes there).
      // No hover story: the gallery does not list it.
      return (
        <svg width="72" height="40" viewBox="0 0 80 44" aria-hidden>
          <rect
            x="3"
            y="3"
            width="74"
            height="38"
            rx="3"
            fill="rgb(248 250 252)"
            stroke="rgb(148 163 184)"
            strokeWidth="1"
          />
          {[9, 15, 21, 27, 33].map((y) =>
            [9, 15, 21, 27, 33, 39, 45, 51, 57, 63, 69].map((x) => (
              <circle key={`${x}-${y}`} cx={x} cy={y + 1} r="0.45" fill="rgb(203 213 225)" />
            )),
          )}
        </svg>
      );
    default:
      return null;
  }
}
