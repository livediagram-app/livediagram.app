'use client';

// A long choice in the options flyout (docs/specs/031-photo/photo-pages.md "The options flyout"): the blend modes and
// the fonts, too many for tiles in place, are a row whose button shows the value and opens a card in the palette's own
// flyout look (CategoryFlyout): a header (the option's glyph, its name and what it does), the values as tiles in
// their sections, each drawn as what it does (option-pictures), and a footer saying what the pointed-at one does.
import { useRef, useState, type ReactNode } from 'react';
import {
  lucideArrowLeftRight,
  lucideBlend,
  lucideBold,
  lucideChevronDown,
  lucideCircle,
  lucideCircleDot,
  lucideCrop,
  lucideDroplet,
  lucideDroplets,
  lucideMinus,
  lucidePenTool,
  lucidePipette,
  lucideRows2,
  lucideScaling,
  lucideShapes,
  lucideSlidersHorizontal,
  lucideSparkle,
  lucideSpline,
  lucideSquare,
  lucideSquareDashed,
  lucideSun,
  lucideTextAlignStart,
  lucideType,
  lucideWand,
} from '@liveworkspace/icons/lucide';
import { FONTS } from '@livedesign/design';
import { lucideGlyph } from '@livedesign/ui';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { FlyoutHeader, onFlyoutArrowKey } from '@/components/palette/CategoryFlyout';
import { FlyoutFooter, Kbd } from '@/components/palette/category-flyout-items';
import { CHOICE_BLURBS, choiceSections, OPTION_GUIDES } from '@/lib/photo-editor/option-guides';
import { choicePicture, pictureFills } from './option-pictures';

const Chevron = lucideGlyph(lucideChevronDown, 12);

// Each option's glyph for its popover's header, by its field key.
const OPTION_GLYPHS: Readonly<Record<string, ReturnType<typeof lucideGlyph>>> = {
  size: lucideGlyph(lucideCircleDot, 18),
  hardness: lucideGlyph(lucideCircle, 18),
  opacity: lucideGlyph(lucideDroplet, 18),
  flow: lucideGlyph(lucideDroplets, 18),
  smoothing: lucideGlyph(lucideSpline, 18),
  mode: lucideGlyph(lucideBlend, 18),
  pressure: lucideGlyph(lucidePenTool, 18),
  eraserMode: lucideGlyph(lucideCircle, 18),
  tolerance: lucideGlyph(lucideWand, 18),
  feather: lucideGlyph(lucideSparkle, 18),
  selection: lucideGlyph(lucideSquareDashed, 18),
  style: lucideGlyph(lucideShapes, 18),
  gradientStyle: lucideGlyph(lucideShapes, 18),
  ratio: lucideGlyph(lucideCrop, 18),
  sample: lucideGlyph(lucidePipette, 18),
  range: lucideGlyph(lucideSun, 18),
  exposure: lucideGlyph(lucideSun, 18),
  font: lucideGlyph(lucideType, 18),
  weight: lucideGlyph(lucideBold, 18),
  align: lucideGlyph(lucideTextAlignStart, 18),
  lineHeight: lucideGlyph(lucideRows2, 18),
  tracking: lucideGlyph(lucideArrowLeftRight, 18),
  strokeWidth: lucideGlyph(lucideMinus, 18),
  radius: lucideGlyph(lucideSquare, 18),
  transformMode: lucideGlyph(lucideScaling, 18),
};
const DefaultGlyph = lucideGlyph(lucideSlidersHorizontal, 18);

export function OptionGlyph({ guide }: { guide: string }) {
  const Glyph = OPTION_GLYPHS[guide] ?? DefaultGlyph;
  return <Glyph />;
}

// The keys a selection mode answers to while a selection tool is in hand (photo-tools.md "Shared gestures").
const SELECTION_KEYS: Readonly<Record<string, string>> = {
  add: 'Shift',
  subtract: 'Alt',
  intersect: 'Shift Alt',
};

/** A button naming an option and showing its value; its popover holds the control. */
export function OptionButton({
  label,
  value,
  width,
  inRow = false,
  children,
}: {
  label: string;
  value: string;
  // In a row that names the option already: the value alone.
  inRow?: boolean;
  // The popover's width, px.
  width: number;
  children: (close: () => void) => ReactNode;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${value}`}
        onClick={() => setOpen((o) => !o)}
        className={`group flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[11px] ring-1 transition ${
          open
            ? 'bg-brand-50 ring-brand-300 dark:bg-brand-500/20 dark:ring-brand-500/50'
            : 'ring-slate-200 hover:bg-slate-50 hover:ring-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800/70'
        }`}
      >
        {inRow ? null : (
          <span className="font-medium text-slate-500 dark:text-slate-400">{label}</span>
        )}
        <span className="whitespace-nowrap font-semibold tabular-nums text-slate-800 dark:text-slate-100">
          {value}
        </span>
        <span
          className={`text-slate-400 transition-transform duration-micro ${open ? 'rotate-180' : ''}`}
        >
          <Chevron />
        </span>
      </button>
      {open && anchor ? (
        <AnchoredPopover anchor={anchor} name={label} width={width} onClose={close}>
          {children(close)}
        </AnchoredPopover>
      ) : null}
    </>
  );
}

/** An option's popover card: the flyout's header, the control, and a footer. */
export function OptionCard({
  guide,
  label,
  footer,
  children,
}: {
  // The option's field key, for its glyph and line.
  guide: string;
  label: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40">
      <FlyoutHeader
        icon={<OptionGlyph guide={guide} />}
        title={label}
        tagline={OPTION_GUIDES[guide]?.blurb ?? `Set the ${label.toLowerCase()}.`}
      />
      {children}
      {footer}
    </div>
  );
}

// What a choice's value does: its own line, or for a font the kind of face it is.
function choiceBlurb(guide: string, value: string | number): string | undefined {
  const own = CHOICE_BLURBS[guide]?.[String(value)];
  if (own) return own;
  if (guide === 'font') return FONTS.find((f) => f.id === value)?.kind;
  return undefined;
}

/** A choice: its values as tiles in their sections, the chosen one marked; a press picks and closes. */
export function OptionChoicePopover<T extends string | number>({
  label,
  guide = label.toLowerCase(),
  value,
  choices,
  inRow,
  onChange,
}: {
  label: string;
  // The option's field key (option-guides); its label in lower case when absent.
  guide?: string;
  value: T;
  choices: readonly { value: T; label: string }[];
  // In a row that names the option already (the options flyout).
  inRow?: boolean;
  onChange: (value: T) => void;
}) {
  const current = choices.find((c) => c.value === value)?.label ?? String(value);
  const fills = choices.some((c) => pictureFills(guide, c.value));
  const sections = choiceSections(guide, choices);
  // Tiles for swatches, four across for the blend modes; rows with a line each otherwise, two across for a long list.
  const swatchColumns = choices.length > 8 ? 5 : 3;
  const rowColumns = choices.length > 6 ? 2 : 1;
  const width = fills ? (swatchColumns === 5 ? 460 : 340) : rowColumns === 2 ? 460 : 340;
  return (
    <OptionButton label={label} value={current} width={width} inRow={inRow}>
      {(close) => (
        <ChoiceBody
          label={label}
          guide={guide}
          value={value}
          sections={sections}
          fills={fills}
          columns={fills ? swatchColumns : rowColumns}
          onPick={(v) => {
            onChange(v);
            close();
          }}
        />
      )}
    </OptionButton>
  );
}

function ChoiceBody<T extends string | number>({
  label,
  guide,
  value,
  sections,
  fills,
  columns,
  onPick,
}: {
  label: string;
  guide: string;
  value: T;
  sections: { title: string | null; choices: { value: T; label: string }[] }[];
  fills: boolean;
  columns: number;
  onPick: (value: T) => void;
}) {
  const [hovered, setHovered] = useState<{ value: T; label: string } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const shown = hovered ?? sections.flatMap((s) => s.choices).find((c) => c.value === value);
  return (
    <OptionCard
      guide={guide}
      label={label}
      footer={
        <FlyoutFooter
          item={
            shown
              ? {
                  name: shown.label,
                  text: choiceBlurb(guide, shown.value) ?? '',
                  shortcut: guide === 'selection' ? SELECTION_KEYS[String(shown.value)] : undefined,
                }
              : null
          }
          hint="Pick one."
        />
      }
    >
      <div
        ref={bodyRef}
        role="listbox"
        aria-label={label}
        onKeyDown={(e) => onFlyoutArrowKey(e, bodyRef.current)}
        onPointerLeave={() => setHovered(null)}
        className="flex max-h-[min(56vh,440px)] animate-fade-in flex-col gap-3 overflow-y-auto p-3"
      >
        {sections.map((section) => (
          <section key={section.title ?? 'all'} aria-label={section.title ?? label}>
            {section.title ? (
              <h4 className="mb-1.5 flex items-center gap-2 px-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {section.title}
                <span aria-hidden className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
              </h4>
            ) : null}
            <div
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
              className={`grid ${fills ? 'gap-1.5' : 'gap-1'}`}
            >
              {section.choices.map((c, i) => {
                const on = c.value === value;
                const picture = choicePicture(guide, c.value);
                const blurb = choiceBlurb(guide, c.value);
                const key = guide === 'selection' ? SELECTION_KEYS[String(c.value)] : undefined;
                return (
                  <button
                    key={String(c.value)}
                    type="button"
                    role="option"
                    aria-selected={on}
                    aria-label={c.label}
                    data-flyout-item=""
                    onClick={() => onPick(c.value)}
                    onPointerEnter={() => setHovered(c)}
                    onFocus={() => setHovered(c)}
                    style={{ '--stagger-i': i } as React.CSSProperties}
                    className={`stagger-enter group relative flex animate-fade-in rounded-xl text-left ring-1 transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 ${
                      fills
                        ? 'flex-col items-stretch gap-1 p-1'
                        : 'items-center gap-2.5 px-2 py-1.5'
                    } ${
                      on
                        ? 'bg-brand-50 ring-brand-300 dark:bg-brand-500/20 dark:ring-brand-500/50'
                        : 'ring-transparent hover:bg-slate-50 hover:ring-slate-200 dark:hover:bg-slate-800/70 dark:hover:ring-slate-700'
                    }`}
                  >
                    {fills ? (
                      <>
                        <span
                          aria-hidden
                          className="block h-9 overflow-hidden rounded-lg bg-slate-50 ring-1 ring-slate-200/80 transition group-hover:shadow-sm dark:bg-slate-800 dark:ring-slate-700"
                        >
                          {picture}
                        </span>
                        <span
                          className={`line-clamp-2 px-0.5 text-center text-[11px] leading-tight [overflow-wrap:anywhere] ${
                            on
                              ? 'font-semibold text-brand-700 dark:text-brand-200'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {c.label}
                        </span>
                      </>
                    ) : (
                      <>
                        {picture ? (
                          <span
                            aria-hidden
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-700 ring-1 ring-slate-200/80 transition group-hover:bg-white group-hover:shadow-sm dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:group-hover:bg-slate-900"
                          >
                            {picture}
                          </span>
                        ) : null}
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex items-center gap-1.5 text-[13px] font-semibold leading-tight text-slate-800 dark:text-slate-100">
                            <span className="truncate">{c.label}</span>
                            {key ? <Kbd small>{key}</Kbd> : null}
                          </span>
                          {blurb ? (
                            <span className="line-clamp-2 text-[11.5px] leading-snug text-slate-500 dark:text-slate-400">
                              {blurb}
                            </span>
                          ) : null}
                        </span>
                        {on ? (
                          <span
                            aria-hidden
                            className="h-2 w-2 shrink-0 rounded-full bg-brand-500 dark:bg-brand-300"
                          />
                        ) : null}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </OptionCard>
  );
}
