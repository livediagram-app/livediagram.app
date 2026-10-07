// Search-panel category illustrations (docs/specs/018-help/help-app.md): the global search overlay with
// a query field and results grouped by type. Composed only from the shared
// primitives (plus a few raw motifs the kit lacks, like the magnifier glyph) so
// the house style holds. The overlay frame is a single reusable component that
// every article fills with different result rows.

import type { ReactNode } from 'react';
import { Scene, Label } from './primitives';

// --- Shared pieces -----------------------------------------------------------

/** A small magnifier glyph, centred on the origin. */
function Magnifier({ tone = 'muted' }: { tone?: 'muted' | 'accent' }) {
  const cls = tone === 'accent' ? 'stroke-brand-500' : 'stroke-slate-400';
  return (
    <g className={cls} strokeWidth={2} fill="none" strokeLinecap="round">
      <circle cx={-1} cy={-1} r={5} />
      <path d="M3 3 L7 7" />
    </g>
  );
}

type Row = {
  /** Glyph drawn in the leading icon slot, centred on the origin. */
  icon: ReactNode;
  label: string;
  /** Muted right-aligned context, as the panel prints it: "on Payments",
   *  "in Platform team", "current". */
  meta?: string;
  /** Brand-highlighted (the preselected first match). */
  active?: boolean;
};

type Group = { title: string; rows: Row[] };

/** The search overlay as the editor draws it: a query row (magnifier, the
 *  typed text, an Esc chip) over a divider, then groups of result rows, the
 *  first preselected. The single reusable surface behind every search figure. */
function SearchOverlay({
  query,
  groups,
  w = 420,
  // height grows with the row count; callers rarely need to override.
  h,
}: {
  query: string;
  groups: Group[];
  w?: number;
  h?: number;
}) {
  const px = 40; // overlay left edge
  const pw = w - px * 2; // overlay width
  const top = 14;
  const fieldH = 38;
  const rowH = 26;
  const groupGap = 6;
  const groupHeadH = 18;

  // Lay out rows top-down, tracking the running y. Plain loops rather than
  // map(), because map's callbacks would close over the running cursor and
  // reassigning a captured binding mid-render is what react-hooks/refs flags.
  const laidGroups: { title: string; headY: number; rows: (Row & { y: number })[] }[] = [];
  let cursorY = top + fieldH + 6;
  for (const g of groups) {
    const headY = cursorY;
    cursorY += groupHeadH;
    const rows: (Row & { y: number })[] = [];
    for (const r of g.rows) {
      rows.push({ ...r, y: cursorY });
      cursorY += rowH;
    }
    cursorY += groupGap;
    laidGroups.push({ title: g.title, headY, rows });
  }
  const overlayH = cursorY - top + 4;
  const sceneH = h ?? overlayH + top * 2;

  return (
    <Scene w={w} h={sceneH} bg="canvas">
      {/* dimmed/blurred canvas behind the overlay */}
      <rect x={0} y={0} width={w} height={sceneH} className="fill-slate-900/10" />

      {/* overlay card */}
      <rect
        x={px}
        y={top}
        width={pw}
        height={overlayH}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />

      {/* query row: magnifier, typed text + caret, Esc chip, divider */}
      <g transform={`translate(${px + 20} ${top + fieldH / 2})`}>
        <Magnifier />
      </g>
      <Label x={px + 36} y={top + fieldH / 2 + 1} size={12} tone="strong" weight={500}>
        {query}
      </Label>
      <rect
        x={px + 36 + query.length * 6.9 + 3}
        y={top + 11}
        width={1.5}
        height={fieldH - 22}
        className="fill-slate-400"
      />
      <rect
        x={px + pw - 40}
        y={top + 10}
        width={28}
        height={18}
        rx={4}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1}
      />
      <Label x={px + pw - 26} y={top + 20} size={10} tone="muted" anchor="middle" weight={500}>
        Esc
      </Label>
      <line
        x1={px}
        y1={top + fieldH}
        x2={px + pw}
        y2={top + fieldH}
        className="stroke-slate-200"
        strokeWidth={1.5}
      />

      {/* groups */}
      {laidGroups.map((g, gi) => (
        <g key={gi}>
          <Label x={px + 14} y={g.headY + groupHeadH / 2 + 1} size={10} weight={700} tone="muted">
            {g.title.toUpperCase()}
          </Label>
          {g.rows.map((r, ri) => {
            const cy = r.y + rowH / 2;
            return (
              <g key={ri}>
                {r.active && (
                  <rect
                    x={px + 2}
                    y={r.y + 1}
                    width={pw - 4}
                    height={rowH - 2}
                    rx={4}
                    className="fill-brand-100"
                  />
                )}
                {/* leading icon */}
                <g transform={`translate(${px + 22} ${cy})`}>{r.icon}</g>
                <Label
                  x={px + 38}
                  y={cy + 1}
                  size={11}
                  weight={r.active ? 600 : 400}
                  tone={r.active ? 'accent' : 'body'}
                >
                  {r.label}
                </Label>
                {r.meta && (
                  <Label x={px + pw - 14} y={cy + 1} size={10} tone="muted" anchor="end">
                    {r.meta}
                  </Label>
                )}
              </g>
            );
          })}
        </g>
      ))}
    </Scene>
  );
}

// --- Reusable result icons ---------------------------------------------------
// One glyph per result kind, after the editor's own (search-panel-icons.tsx):
// a document, a folder, people for a team, a panel for a tab, a circle for an
// element, a plus-in-a-box for Add to canvas, a bolt for an action, sliders for
// a setting, and a question mark for help.

const GLYPH = 'fill-none stroke-slate-500';

/** A document glyph: a small framed canvas with two nodes. */
function DocumentIcon() {
  return (
    <g>
      <rect
        x={-7}
        y={-6}
        width={14}
        height={12}
        rx={2.5}
        className="fill-white stroke-brand-400"
        strokeWidth={1.5}
      />
      <rect x={-4.5} y={-3.5} width={4} height={3.5} rx={1} className="fill-brand-300" />
      <rect x={1} y={0.5} width={4} height={3.5} rx={1} className="fill-brand-200" />
    </g>
  );
}

/** A folder glyph. */
function FolderIcon() {
  return (
    <path
      d="M-7 -5 h4.5 l2 2 h7.5 v8 h-14 Z"
      className={GLYPH}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  );
}

/** The share glyph the Shared with You rows wear: three linked dots. */
function SharedIcon() {
  return (
    <g className={GLYPH} strokeWidth={1.5}>
      <circle cx={4.5} cy={-4.5} r={2.2} />
      <circle cx={-4.5} cy={0} r={2.2} />
      <circle cx={4.5} cy={4.5} r={2.2} />
      <path d="M-2.5 -1 L2.5 -3.5 M-2.5 1 L2.5 3.5" />
    </g>
  );
}

/** A people / team glyph (two heads). */
function TeamIcon() {
  return (
    <g className={GLYPH} strokeWidth={1.5}>
      <circle cx={-2.5} cy={-3} r={2.6} />
      <path d="M-7 6 a4.5 4.5 0 0 1 9 0" />
      <path d="M2.5 -5.5 a2.6 2.6 0 0 1 0 5.2 M4 1.5 a4.5 4.5 0 0 1 3 4.5" />
    </g>
  );
}

/** A tab glyph: a panel with a top bar and a side column. */
function TabIcon() {
  return (
    <g className={GLYPH} strokeWidth={1.5}>
      <rect x={-6.5} y={-6} width={13} height={12} rx={2} />
      <path d="M-6.5 -2 H6.5 M-2 -2 V6" />
    </g>
  );
}

/** An element glyph: the plain circle the panel gives every element. */
function ElementIcon() {
  return <circle r={5.5} className={GLYPH} strokeWidth={1.5} />;
}

/** Add to canvas: a plus in a box. */
function AddIcon() {
  return (
    <g className="fill-none stroke-brand-500" strokeWidth={1.5}>
      <rect x={-6.5} y={-6.5} width={13} height={13} rx={2.5} />
      <path d="M-3 0 H3 M0 -3 V3" />
    </g>
  );
}

/** An action: a bolt. */
function CommandIcon() {
  return (
    <path
      d="M1.5 -7 L-5 1 H0 L-1.5 7 L5 -1 H0 Z"
      className={GLYPH}
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
  );
}

/** A setting: horizontal sliders. */
function SettingIcon() {
  return (
    <g className={GLYPH} strokeWidth={1.5} strokeLinecap="round">
      <path d="M-6.5 -3.5 H6.5 M-6.5 3.5 H6.5" />
      <circle cx={-2} cy={-3.5} r={1.8} className="fill-white stroke-slate-500" />
      <circle cx={3} cy={3.5} r={1.8} className="fill-white stroke-slate-500" />
    </g>
  );
}

/** A help article: a question mark in a circle. */
function HelpIcon() {
  return (
    <g className={GLYPH} strokeWidth={1.5} strokeLinecap="round">
      <circle r={6.5} />
      <path d="M-2 -2 a2 2 0 1 1 2.6 1.9 c-0.6 0.2 -0.6 0.7 -0.6 1.4" />
      <circle cx={0} cy={3.6} r={0.6} className="fill-slate-500" />
    </g>
  );
}

// --- Scenes ------------------------------------------------------------------

/** Mixed results across documents, tabs, elements, actions and help: search at a glance. */
export function SearchOverview() {
  return (
    <SearchOverlay
      query="check"
      groups={[
        {
          title: 'Documents',
          rows: [{ icon: <DocumentIcon />, label: 'Checkout flow', active: true }],
        },
        {
          title: 'Tabs',
          rows: [{ icon: <TabIcon />, label: 'Checkout', meta: 'current' }],
        },
        {
          title: 'Elements',
          rows: [
            { icon: <ElementIcon />, label: 'Check stock', meta: 'on Checkout' },
            { icon: <ElementIcon />, label: 'Payment check', meta: 'on Payments' },
          ],
        },
        {
          title: 'Help',
          rows: [{ icon: <HelpIcon />, label: 'Checklists' }],
        },
      ]}
    />
  );
}

/** Results limited to documents, folders, and shared documents. */
export function SearchDocuments() {
  return (
    <SearchOverlay
      query="onboarding"
      groups={[
        {
          title: 'Documents',
          rows: [{ icon: <DocumentIcon />, label: 'Onboarding flow', active: true }],
        },
        {
          title: 'Shared with You',
          rows: [{ icon: <SharedIcon />, label: 'Onboarding v2' }],
        },
        {
          title: 'My documents',
          rows: [{ icon: <FolderIcon />, label: 'Onboarding' }],
        },
      ]}
    />
  );
}

/** Results showing teams plus their shared folders and documents. */
export function SearchTeams() {
  return (
    <SearchOverlay
      query="platform"
      groups={[
        {
          title: 'Teams',
          rows: [
            { icon: <TeamIcon />, label: 'Platform team', active: true },
            { icon: <FolderIcon />, label: 'Architecture / Services', meta: 'in Platform team' },
            { icon: <DocumentIcon />, label: 'Platform overview', meta: 'in Platform team' },
          ],
        },
      ]}
    />
  );
}

/** Results showing tabs and elements, including table-cell text. */
export function SearchTabsAndElements() {
  return (
    <SearchOverlay
      query="revenue"
      groups={[
        {
          title: 'Tabs',
          rows: [{ icon: <TabIcon />, label: 'Revenue model', active: true }],
        },
        {
          title: 'Elements',
          rows: [
            { icon: <ElementIcon />, label: 'Revenue growth', meta: 'on Revenue model' },
            { icon: <ElementIcon />, label: 'Revenue 2026: 1.2m', meta: 'on Forecast' },
          ],
        },
      ]}
    />
  );
}

/** Palette results under Add to canvas, below an ordinary document match. */
export function SearchAddToCanvas() {
  return (
    <SearchOverlay
      query="cylinder"
      groups={[
        {
          title: 'Documents',
          rows: [{ icon: <DocumentIcon />, label: 'Storage cylinder demo', active: true }],
        },
        {
          title: 'Add to canvas',
          rows: [{ icon: <AddIcon />, label: 'Cylinder' }],
        },
      ]}
    />
  );
}

/** A "Create new tab" action row below an ordinary tab match. */
export function SearchCreateTab() {
  return (
    <SearchOverlay
      query="new"
      groups={[
        {
          title: 'Tabs',
          rows: [{ icon: <TabIcon />, label: 'New ideas', active: true }],
        },
        {
          title: 'Actions',
          rows: [{ icon: <CommandIcon />, label: 'Create new tab' }],
        },
      ]}
    />
  );
}

/** The command palette: actions for a typed verb, with a matching setting below. */
export function SearchCommandPalette() {
  return (
    <SearchOverlay
      query="layout"
      groups={[
        {
          title: 'Actions',
          rows: [
            { icon: <CommandIcon />, label: 'Auto Layout (tidy up)', active: true },
            { icon: <CommandIcon />, label: 'Auto Layout: Flowchart (down)' },
            { icon: <CommandIcon />, label: 'Auto Layout: Tree' },
          ],
        },
        {
          title: 'Help',
          rows: [{ icon: <HelpIcon />, label: 'Layout Cleanup' }],
        },
      ]}
    />
  );
}

/** A Settings result, labelled with the category it opens on. */
export function SearchSettings() {
  return (
    <SearchOverlay
      query="dark"
      groups={[
        {
          title: 'Settings',
          rows: [{ icon: <SettingIcon />, label: 'Theme', meta: 'in Appearance', active: true }],
        },
        {
          title: 'Help',
          rows: [{ icon: <HelpIcon />, label: 'Appearance: Light, Dark, System' }],
        },
      ]}
    />
  );
}
