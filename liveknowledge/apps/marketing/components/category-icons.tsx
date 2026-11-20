import { Glyph, type IconProps } from '@liveknowledge/ui';
import type { ReactElement } from 'react';

// One glyph per feature section (docs/specs/019-marketing/marketing-site.md "Feature sections"), shown beside
// each landing beat's name. Drawn on the shared chrome Glyph (16-unit viewBox, stroke in currentColor) so they
// sit with the rest of the site's icons. Each draws what the section is about; category-icons.test.tsx pins one
// per LANDING_SECTIONS id, none shared.

type Icon = (props: IconProps) => ReactElement;

const glyph =
  (paths: ReactElement): Icon =>
  ({ size = 14, ...rest }) => (
    <Glyph size={size} {...rest}>
      {paths}
    </Glyph>
  );

export const CATEGORY_ICONS: Record<string, Icon> = {
  // Pages: a tree, a page with two subpages under it.
  pages: glyph(
    <>
      <path d="M2.5 2.5h5v3h-5zM8.5 7.5h5v2.5h-5zM8.5 11.5h5v2.5h-5z" />
      <path d="M4.5 5.5v7.25h4M4.5 8.75h4" />
    </>,
  ),
  // Verification: a shield with a tick.
  trust: glyph(
    <>
      <path d="M8 1.5l5 2v4c0 3.2-2.1 5.6-5 7-2.9-1.4-5-3.8-5-7v-4z" />
      <path d="M5.75 8l1.6 1.7 3-3.4" />
    </>,
  ),
  // Ask: a speech bubble holding a question mark.
  ask: glyph(
    <>
      <path d="M2.5 3.5h11v7.5h-6l-3 2.5v-2.5h-2z" />
      <path d="M6.6 6.1a1.5 1.5 0 1 1 2.2 1.3c-.5.3-.8.6-.8 1.1M8 9.9v.1" />
    </>,
  ),
  // Agents: an agent's head, two eyes and an antenna.
  agents: glyph(
    <>
      <path d="M3.5 5.5h9v7.5h-9zM8 5.5v-2.5" />
      <path d="M6.25 8.5v1M9.75 8.5v1M8 2.5v.1" />
    </>,
  ),
  // Import and Export: one arrow in, one arrow out.
  import: glyph(
    <>
      <path d="M2.5 5h8M8 2.5L10.5 5 8 7.5" />
      <path d="M13.5 11h-8M8 8.5L5.5 11 8 13.5" />
    </>,
  ),
  // liveworkspace: four apps as tiles, one of them set apart.
  workspace: glyph(
    <>
      <path d="M2.5 2.5h4.5v4.5h-4.5zM9 9h4.5v4.5h-4.5zM2.5 9h4.5v4.5h-4.5z" />
      <path d="M11.25 2.25l2.5 2.5-2.5 2.5-2.5-2.5z" />
    </>,
  ),
};
