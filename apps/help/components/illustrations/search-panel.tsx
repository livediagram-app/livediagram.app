// Search-panel category illustrations (spec/55): the global search overlay with
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
  /** Muted right-aligned context, e.g. a folder path or "in Platform". */
  meta?: string;
  /** Brand-highlighted (the preselected first match). */
  active?: boolean;
  /** Render as an action row (brand text, distinct from a plain match). */
  action?: boolean;
};

type Group = { title: string; rows: Row[] };

/** The search overlay: a rounded query field with a magnifier, then groups of
 *  result rows. The single reusable surface behind every search-panel figure. */
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
  const fieldY = 24;
  const fieldH = 36;
  const rowH = 26;
  const groupGap = 8;
  const groupHeadH = 16;

  // Lay out rows top-down, tracking the running y. Plain loops rather than
  // map(), because map's callbacks would close over the running cursor and
  // reassigning a captured binding mid-render is what react-hooks/refs flags.
  const laidGroups: { title: string; headY: number; rows: (Row & { y: number })[] }[] = [];
  let cursorY = fieldY + fieldH + 14;
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
  const overlayH = cursorY - 16 + 14;
  const sceneH = h ?? overlayH + 28;

  return (
    <Scene w={w} h={sceneH} bg="canvas">
      {/* dimmed/blurred canvas behind the overlay */}
      <rect x={0} y={0} width={w} height={sceneH} className="fill-slate-900/10" />

      {/* overlay card */}
      <rect
        x={px}
        y={fieldY - 14}
        width={pw}
        height={overlayH}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />

      {/* query field */}
      <rect
        x={px + 14}
        y={fieldY}
        width={pw - 28}
        height={fieldH}
        rx={9}
        className="fill-slate-50 stroke-brand-300"
        strokeWidth={2}
      />
      <g transform={`translate(${px + 32} ${fieldY + fieldH / 2})`}>
        <Magnifier tone="accent" />
      </g>
      <Label x={px + 48} y={fieldY + fieldH / 2 + 1} size={11} tone="strong" weight={500}>
        {query}
      </Label>
      {/* text caret */}
      <rect
        x={px + 48 + query.length * 6 + 3}
        y={fieldY + 9}
        width={1.5}
        height={fieldH - 18}
        className="fill-slate-400"
      />

      {/* groups */}
      {laidGroups.map((g, gi) => (
        <g key={gi}>
          <Label x={px + 16} y={g.headY + groupHeadH / 2 + 1} size={8} weight={700} tone="muted">
            {g.title.toUpperCase()}
          </Label>
          {g.rows.map((r, ri) => {
            const cy = r.y + rowH / 2;
            return (
              <g key={ri}>
                {r.active && (
                  <rect
                    x={px + 10}
                    y={r.y + 1}
                    width={pw - 20}
                    height={rowH - 2}
                    rx={7}
                    className="fill-brand-50"
                  />
                )}
                {/* leading icon */}
                <g transform={`translate(${px + 26} ${cy})`}>{r.icon}</g>
                <Label
                  x={px + 44}
                  y={cy + 1}
                  size={10}
                  weight={r.active || r.action ? 600 : 400}
                  tone={r.active || r.action ? 'accent' : 'body'}
                >
                  {r.label}
                </Label>
                {r.meta && (
                  <Label x={px + pw - 16} y={cy + 1} size={8} tone="muted" anchor="end">
                    {r.meta}
                  </Label>
                )}
                {/* action affordance: a small plus pill on the right */}
                {r.action && (
                  <g transform={`translate(${px + pw - 24} ${cy})`}>
                    <circle r={8} className="fill-brand-500" />
                    <path d="M-3.5 0 H3.5 M0 -3.5 V3.5" className="stroke-white" strokeWidth={2} />
                  </g>
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

/** A diagram / board glyph: a small framed canvas with two nodes. */
function DiagramIcon() {
  return (
    <g>
      <rect
        x={-8}
        y={-7}
        width={16}
        height={14}
        rx={2.5}
        className="fill-white stroke-brand-400"
        strokeWidth={1.5}
      />
      <rect x={-5} y={-4} width={5} height={4} rx={1} className="fill-brand-300" />
      <rect x={2} y={1} width={5} height={4} rx={1} className="fill-brand-200" />
    </g>
  );
}

/** A folder glyph. */
function FolderIcon({ accent = false }: { accent?: boolean }) {
  const cls = accent ? 'fill-brand-400' : 'fill-slate-300';
  return <path d="M-8 -5 h5 l2 2 h9 v8 h-16 Z" className={cls} />;
}

/** A people / team glyph (two overlapping heads). */
function TeamIcon() {
  return (
    <g className="fill-violet-400">
      <circle cx={-4} cy={-3} r={3} />
      <path d="M-9 6 a5 5 0 0 1 10 0 Z" />
      <circle cx={4} cy={-3} r={3} className="fill-violet-300" />
      <path d="M-1 6 a5 5 0 0 1 10 0 Z" className="fill-violet-300" />
    </g>
  );
}

/** A tab glyph (a labelled tab shape). */
function TabIcon({ active = false }: { active?: boolean }) {
  const cls = active ? 'fill-brand-400 stroke-brand-500' : 'fill-white stroke-slate-300';
  return (
    <g>
      <path d="M-8 6 V-3 a2 2 0 0 1 2 -2 h5 l2 2 h5 v9 Z" className={cls} strokeWidth={1.5} />
    </g>
  );
}

/** A generic element glyph: a small rounded node. */
function ElementIcon() {
  return (
    <rect
      x={-8}
      y={-5}
      width={16}
      height={10}
      rx={2.5}
      className="fill-white stroke-brand-400"
      strokeWidth={1.5}
    />
  );
}

/** A table glyph (a small grid). */
function TableIcon() {
  return (
    <g className="fill-none stroke-brand-400" strokeWidth={1.4}>
      <rect x={-8} y={-6} width={16} height={12} rx={1.5} />
      <path d="M-8 -1 H8 M-8 3 H8 M-2 -6 V6 M3 -6 V6" />
    </g>
  );
}

// --- Scenes ------------------------------------------------------------------

/** Mixed results across diagrams, tabs, and elements: search at a glance. */
export function SearchOverview() {
  return (
    <SearchOverlay
      query="check"
      groups={[
        {
          title: 'Diagrams',
          rows: [{ icon: <DiagramIcon />, label: 'Checkout flow', active: true }],
        },
        {
          title: 'Tabs',
          rows: [{ icon: <TabIcon />, label: 'Checkout', meta: 'this diagram' }],
        },
        {
          title: 'Elements',
          rows: [
            { icon: <ElementIcon />, label: 'Check stock' },
            { icon: <ElementIcon />, label: 'Payment check' },
          ],
        },
      ]}
    />
  );
}

/** Results limited to diagrams, folders, and shared diagrams. */
export function SearchDiagrams() {
  return (
    <SearchOverlay
      query="onboarding"
      groups={[
        {
          title: 'Diagrams',
          rows: [{ icon: <DiagramIcon />, label: 'Onboarding flow', active: true }],
        },
        {
          title: 'My Work',
          rows: [{ icon: <FolderIcon accent />, label: 'Onboarding', meta: 'folder' }],
        },
        {
          title: 'Shared with you',
          rows: [{ icon: <DiagramIcon />, label: 'Onboarding v2', meta: 'shared' }],
        },
      ]}
    />
  );
}

/** Results showing teams plus their shared folders and diagrams. */
export function SearchTeams() {
  return (
    <SearchOverlay
      query="platform"
      groups={[
        {
          title: 'Teams',
          rows: [
            { icon: <TeamIcon />, label: 'Platform team', active: true },
            { icon: <FolderIcon accent />, label: 'Architecture', meta: 'in Platform' },
            { icon: <DiagramIcon />, label: 'Platform overview', meta: 'in Platform' },
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
          rows: [{ icon: <TabIcon active />, label: 'Revenue model', active: true }],
        },
        {
          title: 'Elements',
          rows: [
            { icon: <ElementIcon />, label: 'Revenue growth' },
            { icon: <TableIcon />, label: 'Revenue 2026', meta: 'table cell' },
          ],
        },
      ]}
    />
  );
}

/** Palette results with an "add to canvas" affordance. */
export function SearchAddToCanvas() {
  return (
    <SearchOverlay
      query="cylinder"
      groups={[
        {
          title: 'Diagrams',
          rows: [{ icon: <DiagramIcon />, label: 'Storage cylinder demo' }],
        },
        {
          title: 'Add to canvas',
          rows: [
            {
              icon: (
                <path
                  d="M-7 -3 a7 3 0 0 0 14 0 v6 a7 3 0 0 1 -14 0 Z M-7 -3 a7 3 0 0 1 14 0"
                  className="fill-none stroke-brand-500"
                  strokeWidth={1.5}
                />
              ),
              label: 'Cylinder',
              action: true,
            },
            {
              icon: (
                <path
                  d="M0 -7 L7 0 L0 7 L-7 0 Z"
                  className="fill-none stroke-brand-500"
                  strokeWidth={1.5}
                />
              ),
              label: 'Cylinder (database)',
              action: true,
            },
          ],
        },
      ]}
    />
  );
}

/** A "Create new tab" action row alongside an ordinary match. */
export function SearchCreateTab() {
  return (
    <SearchOverlay
      query="new tab"
      groups={[
        {
          title: 'Tabs',
          rows: [
            { icon: <TabIcon active />, label: 'New ideas', active: true, meta: 'this diagram' },
          ],
        },
        {
          title: 'Actions',
          rows: [
            {
              icon: <TabIcon />,
              label: 'Create new tab',
              action: true,
            },
          ],
        },
      ]}
    />
  );
}
