// The Settings dialog (docs/specs/007-editor/user-preferences.md), drawn once for every help
// article that shows it: the shared frame (title, search, the category list, the open pane), the
// on/off `Switch` every settings-style row in the help art uses, and the Editor and Panels panes.
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
  'AI Tools',
  'Documents',
  'Account',
  'Privacy',
] as const;

export type SettingsCategory = (typeof CATEGORIES)[number];

/** The dialog frame: title, the search field over the category list with `active` picked, and
 *  the open pane headed by its name. Children draw the pane's rows (x from 152). */
function SettingsFrame({ active, children }: { active: SettingsCategory; children: ReactNode }) {
  return (
    <Scene w={420} h={236} bg="plain">
      <rect
        x={12}
        y={10}
        width={396}
        height={216}
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
      <line x1={144} y1={46} x2={144} y2={226} className="stroke-slate-200" strokeWidth={1.5} />
      <Label x={158} y={64} size={12} weight={700} tone="strong">
        {active}
      </Label>
      {children}
    </Scene>
  );
}

/** A soft highlight behind the row a section is about. */
function RowHighlight({ y, h }: { y: number; h: number }) {
  return <rect x={152} y={y} width={246} height={h} rx={7} className="fill-brand-50" />;
}

/** A row's label, accented when it is the highlighted one. */
function RowLabel({ y, hot, children }: { y: number; hot?: boolean; children: string }) {
  return (
    <Label x={162} y={y} size={10} weight={hot ? 700 : 500} tone={hot ? 'accent' : 'body'}>
      {children}
    </Label>
  );
}

export type EditorRowKey = 'quick-add' | 'guides' | 'auto-attach';

// The Editor pane's toggles, at their defaults. Element Indicators (a choice) sits second.
const EDITOR_TOGGLES: { key: EditorRowKey | 'middle-pan'; label: string; on: boolean }[] = [
  { key: 'quick-add', label: 'Quick-Add on Hover', on: false },
  { key: 'guides', label: 'Alignment Guides', on: true },
  { key: 'auto-attach', label: 'Auto-Attach Arrows', on: true },
  { key: 'middle-pan', label: 'Middle-Mouse Pan', on: true },
];

const ROW_GAP = 22;
const FIRST_ROW = 88;

/** The Editor pane's rows: the four switches with Element Indicators second, then the Power User
 *  section. */
function EditorRows({ highlight }: { highlight?: EditorRowKey }) {
  // Catalogue order: Quick-Add, Element Indicators, then the remaining switches.
  const toggleY = (i: number) => FIRST_ROW + (i === 0 ? 0 : i + 1) * ROW_GAP;
  const indicatorsY = FIRST_ROW + ROW_GAP;
  const sectionY = FIRST_ROW + 5 * ROW_GAP;
  return (
    <>
      {EDITOR_TOGGLES.map((r, i) => {
        const y = toggleY(i);
        const hot = r.key === highlight;
        return (
          <g key={r.key}>
            {hot && <RowHighlight y={y - 12} h={24} />}
            <RowLabel y={y} hot={hot}>
              {r.label}
            </RowLabel>
            <Switch x={364} y={y - 7.5} on={r.on} />
          </g>
        );
      })}
      <RowLabel y={indicatorsY}>Element Indicators</RowLabel>
      <rect
        x={292}
        y={indicatorsY - 9}
        width={98}
        height={18}
        rx={5}
        className="fill-slate-100 stroke-slate-200"
        strokeWidth={1}
      />
      <rect
        x={294}
        y={indicatorsY - 7}
        width={30}
        height={14}
        rx={4}
        className="fill-white stroke-slate-200"
      />
      {['Top', 'Footer', 'Off'].map((c, j) => (
        <Label
          key={c}
          x={309 + j * 33}
          y={indicatorsY + 0.5}
          size={10}
          anchor="middle"
          weight={j === 0 ? 700 : 500}
          tone={j === 0 ? 'accent' : 'muted'}
        >
          {c}
        </Label>
      ))}
      <Label x={162} y={sectionY - 2} size={10} weight={700} tone="muted">
        POWER USER
      </Label>
      <RowLabel y={sectionY + 16}>Power User Mode</RowLabel>
      <Switch x={364} y={sectionY + 8.5} on={false} />
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
      {highlight === 'panel-opacity' && <RowHighlight y={68} h={40} />}
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
