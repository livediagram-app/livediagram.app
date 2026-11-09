'use client';

// The label toolbar's Text Effects control (docs/specs/008-canvas/text-effects.md "The control"): a
// trigger that opens a popover of two parts, a Highlight colour picker (the one colour picker, No
// Highlight first, then the soft colours) and a row of Gradient tiles. A pick applies to the
// selection and closes the popover; the trigger never takes focus from the text, so the selection
// survives (the editor's blur guard lets focus land in an anchored popover).

import { useState, type ReactNode } from 'react';
import { Glyph, HoverCard } from '@livedocuments/ui';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import {
  COLOUR_PICKER_WIDTH,
  COLOUR_POPOVER_PADDING,
} from '@liveworkspace/workbench/components/colour/colour-metrics';
import { TEXT_GRADIENTS, textGradientCss, textGradientOf } from '@livedocuments/document';
import { ColourPicker } from '@/components/colour/ColourPicker';
import { noColour, standardGroup } from '@/components/colour/colour-options';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { useDocumentColours } from '@/hooks/ui/useDocumentColours';
import { toolbarButtonClass } from '@/components/rich-text/toolbar-chrome';

// The picker's own id for "no highlight", never a colour.
const NO_HIGHLIGHT = 'none';
const PANEL_WIDTH = COLOUR_PICKER_WIDTH + 2 * COLOUR_POPOVER_PADDING + 2;

export type TextEffectPatch = { highlight: string | undefined } | { gradient: string | undefined };

/** The toolbar glyph: an "A" over a marker stroke, its letter in a gradient when one is set. */
function EffectsGlyph({
  highlight,
  gradient,
}: {
  highlight: string | null;
  gradient: string | null;
}) {
  const g = textGradientOf(gradient);
  return (
    <Glyph size={18} units={18} aria-hidden>
      {g ? (
        <defs>
          <linearGradient id="lvd-text-effects-glyph" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={g.from} />
            <stop offset="1" stopColor={g.to} />
          </linearGradient>
        </defs>
      ) : null}
      <rect
        x="2"
        y="10.5"
        width="14"
        height="5"
        rx="1.6"
        fill={highlight ?? '#fde68a'}
        opacity={highlight ? 1 : 0.85}
      />
      <path
        d="M5.2 13.6 9 3.6l3.8 10M6.6 10h4.8"
        fill="none"
        stroke={g ? 'url(#lvd-text-effects-glyph)' : 'currentColor'}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Glyph>
  );
}

function PanelTitle({ children, divided = false }: { children: ReactNode; divided?: boolean }) {
  return (
    <p
      aria-hidden
      className={`mb-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200 ${
        divided ? 'mt-3 border-t border-slate-200 pt-3 dark:border-slate-700' : ''
      }`}
    >
      {children}
    </p>
  );
}

/** The panel's contents: Highlight then Gradient. Exported for its tests. */
export function TextEffectsPanel({
  highlight,
  gradient,
  onApply,
}: {
  highlight: string | null;
  gradient: string | null;
  onApply: (patch: TextEffectPatch) => void;
}) {
  const yours = useDocumentColours();
  // The tiles are drawn on the paper the text sits on, so a pick is seen before it is made.
  const surface = useCanvasSurface();
  const paper = surface === 'dark' ? '#0f172a' : '#ffffff';
  const tile = (active: boolean) =>
    `flex h-9 cursor-pointer items-center justify-center rounded-md border text-[15px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
      active
        ? 'border-brand-500 ring-2 ring-brand-500/40'
        : 'border-slate-200 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500'
    }`;
  return (
    <div>
      <PanelTitle>Highlight</PanelTitle>
      <ColourPicker
        label="Highlight"
        value={highlight ?? NO_HIGHLIGHT}
        leading={[noColour(NO_HIGHLIGHT, 'No Highlight')]}
        standard={[
          { heading: 'Highlights', options: standardGroup('soft', surface, 'hex').options },
        ]}
        yours={yours}
        onPick={(id) => onApply({ highlight: id === NO_HIGHLIGHT ? undefined : id })}
      />
      <PanelTitle divided>Gradient</PanelTitle>
      <div role="group" aria-label="Gradient" className="grid grid-cols-7 gap-1.5">
        <HoverCard title="No Gradient" description="Fill the words in their text colour.">
          <button
            type="button"
            aria-label="No gradient"
            aria-pressed={gradient === null}
            onClick={() => onApply({ gradient: undefined })}
            className={`${tile(gradient === null)} text-slate-500 dark:text-slate-400`}
            style={{ background: paper }}
          >
            <Glyph size={14} units={14} aria-hidden>
              <circle cx="7" cy="7" r="5.5" />
              <path d="M3.2 10.8 10.8 3.2" />
            </Glyph>
          </button>
        </HoverCard>
        {TEXT_GRADIENTS.map((g) => (
          <HoverCard key={g.id} title={g.label} description={`Fill the words with ${g.label}.`}>
            <button
              type="button"
              aria-label={`${g.label} gradient`}
              aria-pressed={gradient === g.id}
              onClick={() => onApply({ gradient: g.id })}
              className={tile(gradient === g.id)}
              style={{ background: paper }}
            >
              <span
                style={{
                  backgroundImage: textGradientCss(g),
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Aa
              </span>
            </button>
          </HoverCard>
        ))}
      </div>
    </div>
  );
}

/** The toolbar's trigger and its popover. */
export function TextEffectsButton({
  highlight,
  gradient,
  onApply,
}: {
  highlight: string | null;
  gradient: string | null;
  onApply: (patch: TextEffectPatch) => void;
}) {
  const [open, setOpen] = useState(false);
  // In state, not a ref: the popover is anchored to it during render.
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <HoverCard
        title="Text Effects"
        description="Highlight or fill the selected words with a gradient."
      >
        <button
          ref={setTrigger}
          type="button"
          aria-label="Text Effects"
          aria-haspopup="dialog"
          aria-expanded={open}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((o) => !o)}
          className={toolbarButtonClass(open || highlight !== null || gradient !== null)}
        >
          <EffectsGlyph highlight={highlight} gradient={gradient} />
        </button>
      </HoverCard>
      {open && trigger ? (
        <AnchoredPopover
          anchor={trigger}
          name="Text Effects"
          width={PANEL_WIDTH}
          onClose={() => setOpen(false)}
          initialFocus="panel"
        >
          <div
            className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
            style={{ padding: COLOUR_POPOVER_PADDING }}
          >
            <TextEffectsPanel
              highlight={highlight}
              gradient={gradient}
              onApply={(patch) => {
                onApply(patch);
                setOpen(false);
              }}
            />
          </div>
        </AnchoredPopover>
      ) : null}
    </>
  );
}
