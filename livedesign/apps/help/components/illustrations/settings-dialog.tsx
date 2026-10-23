// The Settings dialog (docs/specs/007-editor/user-preferences.md), drawn once for every help
// article that shows it: the shared frame (title, search, the category list, the open pane), the
// on/off `Switch` every settings-style row in the help art uses, and the Editor and Panels panes,
// each section one grouped card as the dialog draws it.
// Categories, row labels, order and defaults are lifted from
// apps/live/components/dialogs/settings/settings-catalogue.ts; sub-categories (Draw under Editor,
// Layers / Map / Collaborate / Quick Style under Panels) stay folded, as the dialog opens them.

import type { ReactNode } from 'react';
import { Label, Scene } from './primitives';

/** An on/off switch, brand when on. `sm` sits in a Settings row; `md` in a roomier card. */
export function Switch({
  x,
  y,
  on,
  size = 'sm',
}: {
  x: number;
  y: number;
  on: boolean;
  size?: 'sm' | 'md';
}) {
  const w = size === 'sm' ? 26 : 34;
  const h = size === 'sm' ? 15 : 20;
  const r = h / 2 - 2;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx={h / 2} className={on ? 'fill-brand-500' : 'fill-slate-300'} />
      <circle
        cx={on ? w - h / 2 : h / 2}
        cy={h / 2}
        r={r}
        className="fill-white help-art-as-drawn"
      />
    </g>
  );
}

// The dialog's top-level categories, in catalogue order.
const CATEGORIES = [
  'Editor',
  'Appearance',
  'Keyboard',
  'Panels',
  'Accessibility',
  'Tours',
  'AI Tools',
  'Designs',
  'Account',
  'Privacy',
] as const;

type SettingsCategory = (typeof CATEGORIES)[number];

/** The dialog frame: title, the search field over the category list with `active` picked, and
 *  the open pane headed by its name. Children draw the pane's rows (x from 152). */
function SettingsFrame({ active, children }: { active: SettingsCategory; children: ReactNode }) {
  return (
    <Scene w={420} h={268} bg="plain">
      <rect
        x={12}
        y={10}
        width={396}
        height={248}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <Label x={28} y={30} size={13} weight={700} tone="strong">
        Settings
      </Label>
      <line x1={12} y1={46} x2={408} y2={46} className="stroke-slate-200" strokeWidth={1.5} />
      <rect
        x={22}
        y={54}
        width={112}
        height={20}
        rx={6}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1.2}
      />
      <Label x={30} y={65} size={10} tone="muted">
        Search settings
      </Label>
      {CATEGORIES.map((c, i) => {
        const y = 80 + i * 16;
        const on = c === active;
        return (
          <g key={c}>
            {on && <rect x={22} y={y} width={112} height={15} rx={5} className="fill-brand-50" />}
            <Label x={30} y={y + 8} size={10} weight={on ? 700 : 500} tone={on ? 'accent' : 'body'}>
              {c}
            </Label>
          </g>
        );
      })}
      <line x1={144} y1={46} x2={144} y2={258} className="stroke-slate-200" strokeWidth={1.5} />
      <Label x={158} y={64} size={12} weight={700} tone="strong">
        {active}
      </Label>
      {children}
    </Scene>
  );
}

/** A soft highlight behind the row a section is about. */
function RowHighlight({ y, h }: { y: number; h: number }) {
  return <rect x={154} y={y} width={242} height={h} rx={5} className="fill-brand-50" />;
}

/** A row's label, accented when it is the highlighted one. */
function RowLabel({ y, hot, children }: { y: number; hot?: boolean; children: string }) {
  return (
    <Label x={162} y={y} size={10} weight={hot ? 700 : 500} tone={hot ? 'accent' : 'body'}>
      {children}
    </Label>
  );
}

type EditorRowKey = 'quick-add' | 'guides' | 'auto-attach';

type EditorRow =
  | { key: EditorRowKey | 'middle-pan' | 'power-user'; label: string; on: boolean }
  | { key: 'indicators'; label: string };

// The Editor pane's sections in catalogue order, each one grouped card, every row at its default.
const EDITOR_SECTIONS: { heading: string; rows: EditorRow[] }[] = [
  {
    heading: 'CANVAS',
    rows: [
      { key: 'guides', label: 'Alignment Guides', on: true },
      { key: 'auto-attach', label: 'Auto-Attach Arrows', on: true },
      { key: 'indicators', label: 'Element Indicators' },
    ],
  },
  {
    heading: 'MOUSE',
    rows: [
      { key: 'quick-add', label: 'Quick-Add on Hover', on: false },
      { key: 'middle-pan', label: 'Middle-Mouse Pan', on: true },
    ],
  },
  { heading: 'POWER USER', rows: [{ key: 'power-user', label: 'Power User Mode', on: false }] },
];

const ROW_H = 20;
const SECTION_GAP = 14;
const HEADING_H = 12;
const FIRST_HEADING = 84;

// Where each section's heading sits: each starts below the card above it.
const SECTION_TOPS = EDITOR_SECTIONS.reduce<number[]>(
  (tops, _section, i) =>
    i === 0
      ? [FIRST_HEADING]
      : [
          ...tops,
          tops[i - 1]! + HEADING_H - 4 + EDITOR_SECTIONS[i - 1]!.rows.length * ROW_H + SECTION_GAP,
        ],
  [],
);

/** Element Indicators' segmented Top / Footer / Off, Top picked. */
function IndicatorChoice({ y }: { y: number }) {
  return (
    <>
      <rect
        x={292}
        y={y - 8}
        width={98}
        height={16}
        rx={5}
        className="fill-slate-100 stroke-slate-200"
        strokeWidth={1}
      />
      <rect
        x={294}
        y={y - 6}
        width={30}
        height={12}
        rx={4}
        className="fill-white stroke-slate-200"
      />
      {['Top', 'Footer', 'Off'].map((c, j) => (
        <Label
          key={c}
          x={309 + j * 33}
          y={y + 0.5}
          size={9}
          anchor="middle"
          weight={j === 0 ? 700 : 500}
          tone={j === 0 ? 'accent' : 'muted'}
        >
          {c}
        </Label>
      ))}
    </>
  );
}

/** The Editor pane: a heading over one card per section, its rows split by hairlines. */
function EditorRows({ highlight }: { highlight?: EditorRowKey }) {
  return (
    <>
      {EDITOR_SECTIONS.map((section, s) => {
        const headingY = SECTION_TOPS[s]!;
        const cardY = headingY + HEADING_H - 4;
        const cardH = section.rows.length * ROW_H;
        return (
          <g key={section.heading}>
            <Label x={158} y={headingY} size={8} weight={700} tone="muted">
              {section.heading}
            </Label>
            <rect
              x={152}
              y={cardY}
              width={246}
              height={cardH}
              rx={7}
              className="fill-white stroke-slate-200"
              strokeWidth={1.2}
            />
            {section.rows.map((r, i) => {
              const y = cardY + i * ROW_H + ROW_H / 2;
              const hot = r.key === highlight;
              return (
                <g key={r.key}>
                  {i > 0 && (
                    <line
                      x1={152}
                      x2={398}
                      y1={cardY + i * ROW_H}
                      y2={cardY + i * ROW_H}
                      className="stroke-slate-100"
                      strokeWidth={1}
                    />
                  )}
                  {hot && (
                    <rect
                      x={154}
                      y={cardY + i * ROW_H + 2}
                      width={242}
                      height={ROW_H - 4}
                      rx={5}
                      className="fill-brand-50"
                    />
                  )}
                  <RowLabel y={y} hot={hot}>
                    {r.label}
                  </RowLabel>
                  {'on' in r ? <Switch x={364} y={y - 7.5} on={r.on} /> : <IndicatorChoice y={y} />}
                </g>
              );
            })}
          </g>
        );
      })}
    </>
  );
}

/** The whole dialog as it opens: every category down the left, Editor's pane on the right. */
export function SettingsDialogScene() {
  return (
    <SettingsFrame active="Editor">
      <EditorRows />
    </SettingsFrame>
  );
}

/** Settings > Editor with one row highlighted (or none), each switch at its default. */
export function SettingsEditorPane({ highlight }: { highlight?: EditorRowKey }) {
  return (
    <SettingsFrame active="Editor">
      <EditorRows highlight={highlight} />
    </SettingsFrame>
  );
}

/** Settings > Panels: the Panel Opacity slider. */
export function SettingsPanelsPane({ highlight }: { highlight?: 'panel-opacity' }) {
  return (
    <SettingsFrame active="Panels">
      <rect
        x={152}
        y={74}
        width={246}
        height={28}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      {highlight === 'panel-opacity' && <RowHighlight y={76} h={24} />}
      <RowLabel y={88} hot={highlight === 'panel-opacity'}>
        Panel Opacity
      </RowLabel>
      {/* The slider, at 70%: its range runs from 30% to 100%. */}
      <rect x={250} y={86} width={104} height={4} rx={2} className="fill-slate-200" />
      <rect x={250} y={86} width={59} height={4} rx={2} className="fill-brand-500" />
      <circle cx={309} cy={88} r={6.5} className="fill-white stroke-brand-500" strokeWidth={2} />
      <Label x={388} y={89} size={10} anchor="end" weight={600} tone="body">
        70%
      </Label>
    </SettingsFrame>
  );
}
