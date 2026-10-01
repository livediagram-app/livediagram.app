import type { CSSProperties, ReactNode } from 'react';
import { TemplatePreview } from '@livediagram/template-previews';
import {
  POPULAR_TEMPLATE_KINDS,
  TEMPLATE_COLLECTIONS,
  type TemplateKind,
} from '@livediagram/templates';
import type { HeroEnv } from '@/lib/hero-preview-stage';
import { HERO_CANVAS_CLASS } from './hero-editor-window';

// What each hero button previews behind the hero (docs/specs/019-marketing/hero-environment-preview.md
// "Environments"). The spike draws them from the site's own parts: the editor's canvas for Drawing,
// and the template catalogue's own preview art for the two wizard environments. Each has CONTENT
// (`hero-env-content`), shown just under the buttons while previewing and rising to its own place
// on a launch, and CHROME (`hero-env-chrome`), which only cascades in on a launch.

const BRAINSTORM_KINDS = TEMPLATE_COLLECTIONS.find((c) => c.id === 'brainstorm')?.kinds ?? [];

// The wizard's Popular row (Blank has no art to show), then the catalogue's broad staples.
const DIAGRAM_KINDS: readonly TemplateKind[] = [
  ...POPULAR_TEMPLATE_KINDS.filter((kind) => kind !== 'blank'),
  'swot',
  'timeline',
  'system-architecture',
];

// The cascade index each chrome piece takes (hero-preview.css reads --i).
const at = (i: number) => ({ '--i': i }) as CSSProperties;

function Chrome({ children }: { children: ReactNode }) {
  return (
    <div className="hero-env-chrome pointer-events-none absolute inset-x-0 top-0">{children}</div>
  );
}

function ChromePill({ i, className }: { i: number; className: string }) {
  return (
    <span
      style={at(i)}
      className={`rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 ${className}`}
    />
  );
}

// A blank whiteboard with a pen in hand: the editor's canvas, one stroke drawn on it, and the
// Toolbar layout's strip arriving at the top on a launch.
function DrawingEnvironment() {
  return (
    <div className={`absolute inset-0 ${HERO_CANVAS_CLASS}`}>
      <Chrome>
        <div className="flex justify-between px-6 pt-20">
          <ChromePill i={0} className="h-10 w-10" />
          <div className="flex gap-1" style={at(1)}>
            {Array.from({ length: 7 }, (_, n) => (
              <ChromePill key={n} i={1 + n} className="h-10 w-10" />
            ))}
          </div>
          <ChromePill i={8} className="h-10 w-24" />
        </div>
      </Chrome>
      <svg
        aria-hidden
        viewBox="0 0 600 200"
        className="hero-env-stroke hero-env-content absolute inset-x-0 top-[33rem] mx-auto w-[min(80%,48rem)] text-brand-500"
        fill="none"
        stroke="currentColor"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          pathLength={1}
          d="M20 140c40-70 90-110 140-60s40 90 90 60 60-120 120-90 30 100 90 70 70-80 120-40"
        />
      </svg>
    </div>
  );
}

// The New Document wizard: its heading and a grid of template cards, each the picker's own art.
function WizardEnvironment({ title, kinds }: { title: string; kinds: readonly TemplateKind[] }) {
  return (
    <div className="absolute inset-0 bg-slate-50 dark:bg-slate-950">
      <Chrome>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 pt-20">
          <span style={at(0)} className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </span>
          <div className="flex gap-2">
            <ChromePill i={1} className="h-8 w-20" />
            <ChromePill i={2} className="h-8 w-20" />
          </div>
        </div>
      </Chrome>
      <div className="hero-env-content absolute inset-x-0 top-[33rem] mx-auto grid max-w-5xl grid-cols-3 gap-4 px-6 lg:grid-cols-4">
        {kinds.slice(0, 8).map((kind) => (
          <span
            key={kind}
            className="preview-art-tile flex h-36 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 [&>svg]:h-24 [&>svg]:w-auto"
          >
            <TemplatePreview kind={kind} />
          </span>
        ))}
      </div>
    </div>
  );
}

export function HeroEnvironment({ env }: { env: HeroEnv }) {
  switch (env) {
    case 'drawing':
      return <DrawingEnvironment />;
    case 'diagram':
      return <WizardEnvironment title="What do you want to create?" kinds={DIAGRAM_KINDS} />;
    case 'brainstorm':
      return <WizardEnvironment title="Brainstorm" kinds={BRAINSTORM_KINDS} />;
  }
}
