'use client';

// Fine Tune (docs/specs/011-theme/page-designs.md "Fine tuning"): the worn design's controls, each applying live (a
// slider's drag is one undo step), Shuffle and Try Another, Animate and Speed for a design that moves, the tab
// design's Bold Title and Section Pages and Flow Across Pages, the Contrast Guard, and Reset.
import type { ReactNode } from 'react';
import {
  DESIGN_RANGES,
  PAGE_DESIGN_BY_ID,
  resolveTuning,
  type DesignPalette,
  type PageDesign,
} from '@livedocuments/document';
import { Button, SegmentedToggle, SwitchRow } from '@livedocuments/ui';
import { RANGE_SLIDER } from '@liveworkspace/workbench/components/primitives/surface-classes';
import { ColorSwatch } from '@/components/palette/palette-controls';
import { another, reset, shuffled, tuned } from './design-tune';

const HEAD =
  'text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

function TuneSlider({
  label,
  value,
  min,
  max,
  step,
  shown,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  shown: string;
  onChange: (v: number) => void;
}) {
  // One line: the name, the slider, the value, so a column of them reads as a table.
  return (
    <label className="grid grid-cols-[76px_minmax(0,1fr)_40px] items-center gap-3">
      <span className="text-[12px] font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={RANGE_SLIDER}
      />
      <span className="text-right text-[11px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
        {shown}
      </span>
    </label>
  );
}

// A titled group, a hairline between groups.
function Group({ title, end, children }: { title: string; end?: ReactNode; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-2.5 border-t border-slate-100 px-4 py-3.5 first:border-t-0 dark:border-slate-800"
    >
      <h4 className="flex min-h-5 items-center justify-between gap-2">
        <span className={HEAD}>{title}</span>
        {end}
      </h4>
      {children}
    </section>
  );
}

const SWITCH_TEXT = 'text-[12px] font-medium text-slate-700 dark:text-slate-200';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const POINTS: readonly (readonly [number, number])[] = [0, 0.5, 1].flatMap((y) =>
  [0, 0.5, 1].map((x) => [x, y] as const),
);
const PLACE = [
  'Top Left',
  'Top',
  'Top Right',
  'Left',
  'Centre',
  'Right',
  'Bottom Left',
  'Bottom',
  'Bottom Right',
];

export function DesignFineTune({
  design,
  palette,
  onTab,
  failing,
  scrimmed,
  onSet,
  onTune,
}: {
  design: PageDesign;
  // The colours it draws in now (the theme's, or its own), for the Colours swatches.
  palette: Pick<DesignPalette, 'a' | 'b' | 'c'>;
  // The tab's design (rhythm and flow are the tab's switches).
  onTab: boolean;
  failing: number;
  scrimmed: number;
  // A discrete change: one undo step.
  onSet: (d: PageDesign) => void;
  // A slider's tick: one undo step a gesture.
  onTune: (d: PageDesign) => void;
}) {
  const def = PAGE_DESIGN_BY_ID[design.id];
  const t = resolveTuning(design);
  const has = (c: (typeof def.controls)[number]) => def.controls.includes(c);
  const colors: [string, string, string] = design.colors ?? [palette.a, palette.b, palette.c];
  const setColor = (i: number, hex: string) => {
    const next = [...colors] as [string, string, string];
    next[i] = hex.toLowerCase();
    onSet(tuned(design, 'colors', next));
  };
  return (
    <div className="flex flex-col" data-page-design-tune={design.id}>
      <Group
        title="Look"
        end={
          design.colors ? (
            <button
              type="button"
              className="cursor-pointer text-[11px] font-medium normal-case text-brand-700 hover:underline dark:text-brand-300"
              onClick={() => onSet(tuned(design, 'colors', undefined))}
            >
              Use the Theme’s Colours
            </button>
          ) : (
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Theme colours</span>
          )
        }
      >
        {def.variants && def.variants.length > 1 ? (
          <SegmentedToggle
            label="Style"
            value={t.variant}
            options={def.variants.map((v) => ({
              value: v.id,
              label: v.label,
              description: `${def.label} drawn as ${v.label.toLowerCase()}.`,
            }))}
            onChange={(v) => onSet(tuned(design, 'variant', v))}
            fill
            className="w-full"
          />
        ) : null}
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
          {(['First', 'Second', 'Third'] as const).map((name, i) => (
            <ColorSwatch
              key={name}
              label={name}
              value={colors[i]!}
              onChange={(hex) => setColor(i, hex)}
            />
          ))}
        </div>
      </Group>
      <Group title="Adjust">
        <TuneSlider
          label="Intensity"
          value={t.intensity}
          min={DESIGN_RANGES.intensity[0]}
          max={DESIGN_RANGES.intensity[1]}
          step={0.05}
          shown={pct(t.intensity)}
          onChange={(v) => onTune(tuned(design, 'intensity', v))}
        />
        <TuneSlider
          label="Safe Area"
          value={t.calm}
          min={0}
          max={1}
          step={0.05}
          shown={pct(t.calm)}
          onChange={(v) => onTune(tuned(design, 'calm', v))}
        />
        {has('scale') ? (
          <TuneSlider
            label="Scale"
            value={t.scale}
            min={DESIGN_RANGES.scale[0]}
            max={DESIGN_RANGES.scale[1]}
            step={0.05}
            shown={pct(t.scale)}
            onChange={(v) => onTune(tuned(design, 'scale', v))}
          />
        ) : null}
        {has('angle') ? (
          <TuneSlider
            label="Angle"
            value={t.angle}
            min={0}
            max={355}
            step={5}
            shown={`${t.angle}°`}
            onChange={(v) => onTune(tuned(design, 'angle', v))}
          />
        ) : null}
        {has('blur') ? (
          <TuneSlider
            label="Blur"
            value={t.blur}
            min={0}
            max={1}
            step={0.05}
            shown={pct(t.blur)}
            onChange={(v) => onTune(tuned(design, 'blur', v))}
          />
        ) : null}
        <TuneSlider
          label="Grain"
          value={t.grain}
          min={0}
          max={1}
          step={0.05}
          shown={pct(t.grain)}
          onChange={(v) => onTune(tuned(design, 'grain', v))}
        />
        {has('focus') ? (
          <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-3">
            <span className="text-[12px] font-medium text-slate-700 dark:text-slate-200">
              Position
            </span>
            <div
              role="group"
              aria-label="Position"
              className="grid w-fit grid-cols-3 gap-0.5 rounded-md bg-slate-100 p-0.5 dark:bg-slate-800"
            >
              {POINTS.map(([x, y], i) => {
                const on = Math.abs(t.focus[0] - x) < 0.17 && Math.abs(t.focus[1] - y) < 0.17;
                return (
                  <button
                    key={PLACE[i]}
                    type="button"
                    aria-label={PLACE[i]}
                    aria-pressed={on}
                    onClick={() => onSet(tuned(design, 'focus', [x, y]))}
                    className="flex h-5 w-5 cursor-pointer items-center justify-center rounded hover:bg-white dark:hover:bg-slate-700"
                  >
                    <span
                      className={`block rounded-full ${on ? 'h-2.5 w-2.5 bg-brand-500' : 'h-1.5 w-1.5 bg-slate-400 dark:bg-slate-500'}`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </Group>
      <Group title={has('seed') ? `Variation ${t.seed}` : 'Variation'}>
        <div className="grid grid-cols-2 gap-1.5">
          {has('seed') ? (
            <Button variant="secondary" size="xs" onClick={() => onSet(shuffled(design))}>
              Shuffle
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="xs"
            className={has('seed') ? '' : 'col-span-2'}
            onClick={() => onSet(another(design))}
          >
            Try Another
          </Button>
        </div>
      </Group>
      {def.animates ? (
        <Group title="Motion">
          <SwitchRow
            checked={!!design.animate}
            onChange={(on) => onSet(tuned(design, 'animate', on ? true : undefined))}
            className={SWITCH_TEXT}
          >
            Animate
          </SwitchRow>
          {design.animate ? (
            <TuneSlider
              label="Speed"
              value={t.speed}
              min={DESIGN_RANGES.speed[0]}
              max={DESIGN_RANGES.speed[1]}
              step={0.25}
              shown={pct(t.speed)}
              onChange={(v) => onTune(tuned(design, 'speed', v))}
            />
          ) : null}
          <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            Moves gently on screen. Still with Reduce Motion, in exports and thumbnails.
          </p>
        </Group>
      ) : null}
      {onTab ? (
        <Group title="Pages">
          <SwitchRow
            checked={!!design.rhythm}
            onChange={(on) => onSet(tuned(design, 'rhythm', on ? true : undefined))}
            className={SWITCH_TEXT}
          >
            Bold Title and Section Pages
          </SwitchRow>
          {def.flows ? (
            <SwitchRow
              checked={!!design.flow}
              onChange={(on) => onSet(tuned(design, 'flow', on ? true : undefined))}
              className={SWITCH_TEXT}
            >
              Flow Across Pages
            </SwitchRow>
          ) : null}
        </Group>
      ) : null}
      <Group title="Readability">
        <SegmentedToggle
          label="Contrast Guard"
          value={design.guard === 'warn' ? 'warn' : 'scrim'}
          options={[
            {
              value: 'scrim',
              label: 'Add a Scrim',
              description:
                'A soft plate of the page’s colour under a text the design makes hard to read.',
            },
            {
              value: 'warn',
              label: 'Warn Only',
              description: 'Draws no plate; says here how many texts are hard to read.',
            },
          ]}
          onChange={(v) => onSet(tuned(design, 'guard', v === 'warn' ? 'warn' : undefined))}
          fill
          className="w-full"
        />
        <p
          className={`text-[11px] leading-snug ${failing > 0 && design.guard === 'warn' ? 'font-medium text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}
          data-page-design-guard=""
        >
          {guardLine(design.guard === 'warn', failing, scrimmed)}
        </p>
      </Group>
    </div>
  );
}

/** Reset, for Fine Tune's header: the design's own defaults again. */
export function resetDesign(design: PageDesign): PageDesign {
  return reset(design);
}

/** The Contrast Guard's line for the page someone is on. */
export function guardLine(warn: boolean, failing: number, scrimmed: number): string {
  const texts = (n: number) => (n === 1 ? '1 text' : `${n} texts`);
  if (warn)
    return failing === 0
      ? 'Every text on this page reads clearly.'
      : `${texts(failing)} on this page ${failing === 1 ? 'is' : 'are'} hard to read on this design.`;
  return scrimmed === 0
    ? 'Every text on this page reads clearly.'
    : `A scrim keeps ${texts(scrimmed)} on this page readable.`;
}
