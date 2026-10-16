import type { ComponentType } from 'react';
import {
  FlipchartIcon,
  FlowchartIcon,
  IllustrateIcon,
  MarkerIcon,
  PlanIcon,
  type IconProps,
} from './icons';

// The blanks the Start Blank menu offers (docs/specs/019-marketing/marketing-site.md "The Start Blank
// menu"), as plain data: a server-rendered page reads it too (the marketing site's closing band), which
// it cannot do through the menu's client module.

// One blank per editor mode, in mode order: the menu's rows, and the public sites' closing band's
// launcher (apps/marketing StartDrawingCta), so the two never drift.
export const START_BLANKS: readonly {
  label: string;
  desc: string;
  href: string;
  // The slot's blank, after its place: `Draw` is `HeaderDraw` in the header.
  blank: 'Draw' | 'Whiteboard' | 'Session' | 'Illustration' | 'Plan';
  Icon: ComponentType<IconProps>;
}[] = [
  {
    label: 'Blank Diagram',
    desc: 'Shapes and connectors that snap into place',
    href: '/new?blank=1',
    blank: 'Draw',
    Icon: FlowchartIcon,
  },
  {
    label: 'Blank Whiteboard',
    desc: 'Sketch freehand, tidied into shapes as you go',
    href: '/new?template=whiteboard',
    blank: 'Whiteboard',
    Icon: MarkerIcon,
  },
  {
    label: 'Blank Session',
    desc: 'Timers, votes, polls and reveals for a session',
    href: '/new?template=blank-session',
    blank: 'Session',
    Icon: FlipchartIcon,
  },
  {
    label: 'Blank Illustration',
    desc: 'Pages for slides, infographics, articles and logos',
    href: '/new?template=blank-illustration',
    blank: 'Illustration',
    Icon: IllustrateIcon,
  },
  {
    label: 'Blank Plan',
    desc: 'Pick a board or a sheet that fits the work',
    href: '/new?template=blank-plan',
    blank: 'Plan',
    Icon: PlanIcon,
  },
];
