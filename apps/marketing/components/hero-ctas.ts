import type { ComponentType } from 'react';
import type { CtaSource } from '@livediagram/api-schema';
import { templateBrowseHref, templateCreateHref } from '@livediagram/templates';
import {
  buttonClassName,
  FlowchartIcon,
  MarkerIcon,
  MindmapIcon,
  type IconProps,
} from '@livediagram/ui';
import type { HeroEnv } from '@/lib/hero-preview-stage';

// The hero's three ways to start, each with its icon, its landing-funnel source
// (docs/specs/019-marketing/landing-funnel.md) and the environment it previews
// (docs/specs/019-marketing/hero-environment-preview.md).
export const HERO_CTAS: readonly {
  label: string;
  href: string;
  source: CtaSource;
  env: HeroEnv;
  Icon: ComponentType<IconProps>;
}[] = [
  {
    label: 'Drawing',
    href: templateCreateHref('whiteboard'),
    source: 'Home.HeroDraw',
    env: 'drawing',
    Icon: MarkerIcon,
  },
  { label: 'Diagram', href: '/new', source: 'Home.Hero', env: 'diagram', Icon: FlowchartIcon },
  {
    label: 'Brainstorm',
    href: templateBrowseHref('brainstorm'),
    source: 'Home.HeroBrainstorm',
    env: 'brainstorm',
    Icon: MindmapIcon,
  },
];

// One class for all three: the secondary style (none filled), one height from the size, one width
// from sm up, so they read as peers and the row holds still.
export const HERO_CTA_CLASS = buttonClassName({
  variant: 'secondary',
  size: 'lg',
  className: 'w-full shadow-sm sm:w-44',
});
