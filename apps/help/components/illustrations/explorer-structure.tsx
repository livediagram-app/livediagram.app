// Explorer structure illustrations (docs/specs/018-help/help-app.md): the full-page Explorer's
// sidebar groups and pane header, the editor's floating Explorer panel, the filter lens on Search
// results, the card view with a folder's preview mosaic, the Change Folder dialog and the folder
// menu's Use as default for. Every label is the real one from apps/live (sidebar-structure.ts,
// PaneHeader.tsx, ViewToggle.tsx, ExplorerHeaderMenu.tsx, MoveToFolderDialog.tsx,
// folder-actions-menu.tsx, default-key-entries.ts and the explorer-lens catalogue).
//
// Rows, cards and glyphs are drawn locally rather than with the explorer-parts kit so every label
// stays at 10 units or more, the house minimum.

import { Fragment } from 'react';
import { Scene, Label, Button } from './primitives';

// --- Local parts -------------------------------------------------------------

type GlyphKind =
  'home' | 'activity' | 'shared' | 'folder' | 'team' | 'plus' | 'library' | 'trash' | 'doc';

/** A 14x14 sidebar glyph centred on the origin. */
function Glyph({ kind, active = false }: { kind: GlyphKind; active?: boolean }) {
  const stroke = active ? 'stroke-brand-600' : 'stroke-slate-400';
  const common = {
    className: `${stroke} fill-none`,
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (kind) {
    case 'home':
      return <path d="M-6 0 L0 -6 L6 0 M-4.5 -1.5 V6 H4.5 V-1.5" {...common} />;
    case 'activity':
      return (
        <g {...common}>
          <circle r={6} />
          <path d="M-3 0 L-1 2.5 L3.5 -2.5" />
        </g>
      );
    case 'shared':
      return (
        <g {...common}>
          <circle cx={-2.5} cy={-2} r={2.2} />
          <path d="M-6.5 5.5 a4 3.5 0 0 1 8 0" />
          <circle cx={4} cy={-1} r={1.8} />
          <path d="M3 5.5 h3.5" />
        </g>
      );
    case 'folder':
      return (
        <path
          d="M-6 -4 h4 l1.5 2 h6.5 v7 h-12 Z"
          className={`${stroke} ${active ? 'fill-brand-100' : 'fill-slate-100'}`}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      );
    case 'team':
      return (
        <g {...common}>
          <circle cx={0} cy={-2.5} r={2.4} />
          <path d="M-4.5 5.5 a4.5 3.8 0 0 1 9 0" />
        </g>
      );
    case 'plus':
      return <path d="M0 -5 V5 M-5 0 H5" {...common} />;
    case 'library':
      return (
        <g {...common}>
          <rect x={-6} y={-5} width={12} height={10} rx={1.5} />
          <path d="M-6 3 L-1 -1 L2 1.5 L6 -1.5" />
        </g>
      );
    case 'trash':
      return (
        <path
          d="M-5.5 -3.5 H5.5 M-2 -3.5 V-5.5 H2 V-3.5 M-4 -3.5 L-3.2 5.5 H3.2 L4 -3.5"
          {...common}
        />
      );
    default:
      return (
        <g {...common}>
          <path d="M-4 -6 h5.5 l3 3 v9 h-8.5 Z" />
          <path d="M1.5 -6 v3 h3" />
        </g>
      );
  }
}

/** A small uppercase group title (Overview, Spaces, More, Current Document). */
function GroupTitle({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <Label x={x} y={y} size={10} weight={700} tone="muted">
      {children}
    </Label>
  );
}

/** One tree row: a chevron gutter, a glyph, a label and an optional count badge. */
function TreeRow({
  x,
  y,
  w,
  label,
  glyph,
  active = false,
  level = 0,
  chevron,
  count,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  glyph: GlyphKind;
  active?: boolean;
  level?: number;
  chevron?: 'open' | 'closed';
  count?: number;
}) {
  const h = 18;
  const cy = y + h / 2;
  const gx = x + 8 + level * 12;
  return (
    <g>
      {active && <rect x={x + 2} y={y} width={w - 4} height={h} rx={6} className="fill-brand-50" />}
      {chevron && (
        <path
          d={
            chevron === 'open'
              ? `M${gx - 3} ${cy - 2} l3 3 l3 -3`
              : `M${gx - 1.5} ${cy - 3.5} l3 3.5 l-3 3.5`
          }
          className="stroke-slate-400"
          strokeWidth={1.4}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <g transform={`translate(${gx + 13} ${cy})`}>
        <Glyph kind={glyph} active={active} />
      </g>
      <Label
        x={gx + 25}
        y={cy + 1}
        size={10}
        weight={active ? 700 : 500}
        tone={active ? 'accent' : 'body'}
      >
        {label}
      </Label>
      {count !== undefined && (
        <g>
          <rect x={x + w - 26} y={y + 3} width={20} height={12} rx={6} className="fill-slate-200" />
          <Label x={x + w - 16} y={cy + 1} anchor="middle" size={10} weight={700} tone="body">
            {count}
          </Label>
        </g>
      )}
    </g>
  );
}

/** The List / Card toggle: two square buttons, the card side pressed. */
function ViewToggle({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={42}
        height={22}
        rx={6}
        className="fill-slate-100 stroke-slate-200"
        strokeWidth={1}
      />
      {/* List view */}
      <path
        d={`M${x + 6} ${y + 7} h10 M${x + 6} ${y + 11} h10 M${x + 6} ${y + 15} h10`}
        className="stroke-slate-400"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      {/* Card view, pressed */}
      <rect
        x={x + 22}
        y={y + 2}
        width={18}
        height={18}
        rx={4}
        className="fill-white stroke-slate-200"
        strokeWidth={1}
      />
      <g className="fill-brand-500">
        <rect x={x + 26} y={y + 6} width={4} height={4} rx={1} />
        <rect x={x + 32} y={y + 6} width={4} height={4} rx={1} />
        <rect x={x + 26} y={y + 12} width={4} height={4} rx={1} />
        <rect x={x + 32} y={y + 12} width={4} height={4} rx={1} />
      </g>
    </g>
  );
}

/** A tiny diagram drawn in a card's preview area. */
function Thumb({ x, y, w, h, kind }: { x: number; y: number; w: number; h: number; kind: number }) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  if (kind === 1) {
    return (
      <g>
        <rect x={cx - 10} y={y + 6} width={20} height={9} rx={2} className="fill-brand-300" />
        <rect x={x + 8} y={cy + 4} width={18} height={9} rx={2} className="fill-brand-200" />
        <rect x={x + w - 26} y={cy + 4} width={18} height={9} rx={2} className="fill-brand-200" />
        <path
          d={`M${cx} ${y + 15} V${cy} M${x + 17} ${cy} H${x + w - 17} M${x + 17} ${cy} V${cy + 4} M${x + w - 17} ${cy} V${cy + 4}`}
          className="stroke-slate-300"
          strokeWidth={1.3}
          fill="none"
        />
      </g>
    );
  }
  if (kind === 2) {
    return (
      <g>
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={cx - 22 + (i % 2) * 24}
            y={cy - 14 + Math.floor(i / 2) * 16}
            width={20}
            height={12}
            rx={2}
            className={i % 3 === 0 ? 'fill-brand-300' : 'fill-brand-100'}
          />
        ))}
      </g>
    );
  }
  return (
    <g>
      <rect x={x + 10} y={cy - 6} width={20} height={12} rx={2} className="fill-brand-300" />
      <ellipse cx={x + w - 18} cy={cy} rx={9} ry={6} className="fill-brand-100" />
      <path
        d={`M${x + 30} ${cy} H${x + w - 28}`}
        className="stroke-brand-400"
        strokeWidth={1.5}
        fill="none"
      />
    </g>
  );
}

/** An amber favourite star, centred on (x, y). */
function Star({ x, y }: { x: number; y: number }) {
  return (
    <path
      transform={`translate(${x} ${y})`}
      d="M0 -5 L1.5 -1.6 L5 -1.5 L2.3 0.8 L3.1 4.5 L0 2.5 L-3.1 4.5 L-2.3 0.8 L-5 -1.5 L-1.5 -1.6 Z"
      className="fill-amber-400"
    />
  );
}

/** A document card: the preview above the name and a meta line. */
function DocCard({
  x,
  y,
  w,
  h,
  title,
  meta,
  thumb = 0,
  star = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  meta: string;
  thumb?: number;
  star?: boolean;
}) {
  const previewH = h - 36;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <path
        d={`M${x} ${y + 8} a8 8 0 0 1 8 -8 H${x + w - 8} a8 8 0 0 1 8 8 V${y + previewH} H${x} Z`}
        className="fill-slate-50"
      />
      <Thumb x={x} y={y} w={w} h={previewH} kind={thumb} />
      <Label x={x + 8} y={y + previewH + 12} size={10} weight={600} tone="strong">
        {title}
      </Label>
      {star && <Star x={x + 12} y={y + previewH + 27} />}
      <Label x={x + (star ? 20 : 8)} y={y + previewH + 27} size={10} tone="muted">
        {meta}
      </Label>
    </g>
  );
}

/** A folder card whose preview is the mosaic of what it holds: up to three snapshots, then +N. */
function FolderCard({
  x,
  y,
  w,
  h,
  title,
  meta,
  more,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  meta: string;
  more: number;
}) {
  const previewH = h - 36;
  const tileW = (w - 18) / 2;
  const tileH = (previewH - 15) / 2;
  const tile = (i: number) => ({
    tx: x + 6 + (i % 2) * (tileW + 6),
    ty: y + 6 + Math.floor(i / 2) * (tileH + 3),
  });
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <path
        d={`M${x} ${y + 8} a8 8 0 0 1 8 -8 H${x + w - 8} a8 8 0 0 1 8 8 V${y + previewH} H${x} Z`}
        className="fill-slate-50"
      />
      {[0, 1, 2].map((i) => {
        const { tx, ty } = tile(i);
        return (
          <g key={i}>
            <rect
              x={tx}
              y={ty}
              width={tileW}
              height={tileH}
              rx={3}
              className="fill-white stroke-slate-200"
              strokeWidth={1}
            />
            <rect
              x={tx + 5}
              y={ty + tileH / 2 - 4}
              width={tileW / 3}
              height={8}
              rx={1.5}
              className={i === 1 ? 'fill-brand-200' : 'fill-brand-300'}
            />
            <rect
              x={tx + tileW / 2 + 4}
              y={ty + tileH / 2 - 3}
              width={tileW / 4}
              height={6}
              rx={1.5}
              className="fill-brand-100"
            />
          </g>
        );
      })}
      {(() => {
        const { tx, ty } = tile(3);
        return (
          <g>
            <rect x={tx} y={ty} width={tileW} height={tileH} rx={3} className="fill-slate-100" />
            <Label
              x={tx + tileW / 2}
              y={ty + tileH / 2 + 1}
              anchor="middle"
              size={10}
              weight={700}
              tone="muted"
            >
              {`+${more}`}
            </Label>
          </g>
        );
      })()}
      <g transform={`translate(${x + 15} ${y + previewH + 12})`}>
        <Glyph kind="folder" />
      </g>
      <Label x={x + 26} y={y + previewH + 12} size={10} weight={600} tone="strong">
        {title}
      </Label>
      <Label x={x + 8} y={y + previewH + 27} size={10} tone="muted">
        {meta}
      </Label>
    </g>
  );
}

/** A filter chip: a rounded pill, brand-tinted when set. */
function Chip({
  x,
  w,
  label,
  set = false,
}: {
  x: number;
  w: number;
  label: string;
  set?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={76}
        width={w}
        height={20}
        rx={10}
        className={set ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-300'}
        strokeWidth={1.2}
      />
      <Label
        x={x + w / 2}
        y={86.5}
        anchor="middle"
        size={10}
        weight={600}
        tone={set ? 'accent' : 'body'}
      >
        {label}
      </Label>
    </g>
  );
}

/** A compact list row: thumbnail, name, and a muted note on the right. */
function ListRow({
  x,
  y,
  w,
  title,
  note,
  ai = false,
}: {
  x: number;
  y: number;
  w: number;
  title: string;
  note: string;
  ai?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={30}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <rect
        x={x + 8}
        y={y + 7}
        width={24}
        height={16}
        rx={3}
        className="fill-slate-100 stroke-slate-200"
        strokeWidth={1}
      />
      <rect x={x + 11} y={y + 11} width={10} height={8} rx={1.5} className="fill-brand-300" />
      <Label x={x + 42} y={y + 16} size={10} weight={600} tone="strong">
        {title}
      </Label>
      {ai && (
        <g>
          <rect
            x={x + w - 170}
            y={y + 8}
            width={70}
            height={14}
            rx={7}
            className="fill-violet-100"
          />
          <Label
            x={x + w - 135}
            y={y + 15.5}
            anchor="middle"
            size={10}
            weight={600}
            className="fill-violet-700 dark:fill-violet-300"
          >
            Made by AI
          </Label>
        </g>
      )}
      <Label x={x + w - 90} y={y + 16} size={10} tone="muted">
        {note}
      </Label>
    </g>
  );
}

// --- Scenes ------------------------------------------------------------------

/** The full-page Explorer: the sidebar's three groups, and My documents in the card view with the
 *  pane header's Create button and List / Card toggle. */
export function ExplorerPageLayout() {
  const sx = 16;
  const sw = 146;
  return (
    <Scene w={420} h={264} bg="plain">
      <rect
        x={sx}
        y={16}
        width={sw}
        height={232}
        rx={10}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1.5}
      />
      <GroupTitle x={sx + 12} y={32}>
        OVERVIEW
      </GroupTitle>
      <TreeRow x={sx} y={40} w={sw} label="Home" glyph="home" />
      <TreeRow x={sx} y={58} w={sw} label="Activity" glyph="activity" />
      <TreeRow x={sx} y={76} w={sw} label="Shared with me" glyph="shared" count={3} />
      <GroupTitle x={sx + 12} y={108}>
        SPACES
      </GroupTitle>
      <TreeRow x={sx} y={116} w={sw} label="My documents" glyph="folder" active chevron="open" />
      <TreeRow x={sx} y={134} w={sw} label="Projects" glyph="folder" level={1} chevron="closed" />
      <TreeRow x={sx} y={152} w={sw} label="Design" glyph="team" chevron="closed" />
      <TreeRow x={sx} y={170} w={sw} label="New team" glyph="plus" />
      <GroupTitle x={sx + 12} y={202}>
        MORE
      </GroupTitle>
      <TreeRow x={sx} y={210} w={sw} label="Library" glyph="library" chevron="closed" />
      <TreeRow x={sx} y={228} w={sw} label="Trash" glyph="trash" />

      {/* The pane: heading, Create and the List / Card toggle, then the cards. */}
      <rect
        x={172}
        y={16}
        width={232}
        height={232}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={184} y={36} size={13} weight={700} tone="strong">
        My documents
      </Label>
      <Button x={300} y={25} w={52} h={22} label="Create" />
      <ViewToggle x={356} y={25} />
      <FolderCard x={184} y={58} w={102} h={88} title="Projects" meta="7 items" more={4} />
      <DocCard x={292} y={58} w={102} h={88} title="Roadmap" meta="2h ago" thumb={1} star />
      <DocCard x={184} y={152} w={102} h={88} title="Onboarding" meta="Yesterday" />
      <DocCard x={292} y={152} w={102} h={88} title="Data model" meta="Mon" thumb={2} />
    </Scene>
  );
}

/** The editor's floating Explorer panel: the Current Document card, then Overview, Spaces and More,
 *  with My documents opened in place to a folder and a document. */
export function ExplorerPanelTree() {
  const px = 24;
  const pw = 200;
  return (
    <Scene w={420} h={310}>
      {/* The canvas behind the panel */}
      <rect
        x={262}
        y={50}
        width={76}
        height={38}
        rx={6}
        className="fill-white stroke-brand-200"
        strokeWidth={2}
      />
      <rect
        x={300}
        y={150}
        width={76}
        height={38}
        rx={6}
        className="fill-white stroke-brand-200"
        strokeWidth={2}
      />
      <path d="M300 88 L330 150" className="stroke-brand-200" strokeWidth={2} fill="none" />

      <rect
        x={px}
        y={14}
        width={pw}
        height={284}
        rx={10}
        className="fill-white stroke-slate-300"
        strokeWidth={2}
      />
      <Label x={px + 14} y={32} size={11} weight={700} tone="strong">
        Explorer
      </Label>
      {/* Help and the ⋯ menu */}
      <circle
        cx={px + pw - 38}
        cy={31}
        r={7}
        className="fill-none stroke-slate-300"
        strokeWidth={1.3}
      />
      <Label x={px + pw - 38} y={32} anchor="middle" size={10} weight={700} tone="muted">
        ?
      </Label>
      <g className="fill-slate-400">
        <circle cx={px + pw - 20} cy={31} r={1.5} />
        <circle cx={px + pw - 15} cy={31} r={1.5} />
        <circle cx={px + pw - 10} cy={31} r={1.5} />
      </g>
      <line x1={px} y1={46} x2={px + pw} y2={46} className="stroke-slate-200" strokeWidth={1.5} />

      {/* Current Document */}
      <rect x={px + 8} y={52} width={pw - 16} height={46} rx={8} className="fill-slate-50" />
      <GroupTitle x={px + 16} y={64}>
        CURRENT DOCUMENT
      </GroupTitle>
      <TreeRow x={px + 8} y={74} w={pw - 16} label="Roadmap" glyph="doc" active />

      <GroupTitle x={px + 14} y={112}>
        OVERVIEW
      </GroupTitle>
      <TreeRow x={px + 4} y={120} w={pw - 8} label="Home" glyph="home" />
      <TreeRow x={px + 4} y={138} w={pw - 8} label="Activity" glyph="activity" />
      <TreeRow
        x={px + 4}
        y={156}
        w={pw - 8}
        label="Shared with me"
        glyph="shared"
        chevron="closed"
      />
      <GroupTitle x={px + 14} y={186}>
        SPACES
      </GroupTitle>
      <TreeRow x={px + 4} y={194} w={pw - 8} label="My documents" glyph="folder" chevron="open" />
      <TreeRow
        x={px + 4}
        y={212}
        w={pw - 8}
        label="Projects"
        glyph="folder"
        level={1}
        chevron="closed"
      />
      <TreeRow x={px + 4} y={230} w={pw - 8} label="Quick sketch" glyph="doc" level={1} />
      <GroupTitle x={px + 14} y={262}>
        MORE
      </GroupTitle>
      <TreeRow x={px + 4} y={270} w={pw - 8} label="Library" glyph="library" chevron="closed" />
    </Scene>
  );
}

/** Search results narrowed by a typed Made by AI filter and a word: the pill in the field, the lit
 *  chip in the row (Space included, as on every gathered list), and the documents that match. */
export function FilterSearchResults() {
  const chips: { w: number; label: string; set?: boolean }[] = [
    { w: 54, label: 'Opens in' },
    { w: 36, label: 'Kind' },
    { w: 56, label: 'Template' },
    { w: 78, label: '✓ Made by AI', set: true },
    { w: 44, label: 'Edited' },
    { w: 46, label: 'People' },
    { w: 42, label: 'Space' },
  ];
  let cx = 14;
  return (
    <Scene w={440} h={190} bg="plain">
      {/* The field in the top bar: a pill, then the words. */}
      <rect
        x={170}
        y={14}
        width={256}
        height={26}
        rx={8}
        className="fill-white stroke-brand-400"
        strokeWidth={1.5}
      />
      <circle cx={184} cy={26.5} r={4} className="stroke-slate-400" strokeWidth={1.5} fill="none" />
      <path
        d="M187 29.5l3 3"
        className="stroke-slate-400"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <rect
        x={196}
        y={18}
        width={86}
        height={18}
        rx={9}
        className="fill-brand-50 stroke-brand-300"
        strokeWidth={1.2}
      />
      <Label x={239} y={27.5} anchor="middle" size={10} weight={600} tone="accent">
        Made by AI ×
      </Label>
      <Label x={290} y={27.5} size={10} tone="strong">
        payment
      </Label>

      <Label x={14} y={60} size={13} weight={700} tone="strong">
        Search results
      </Label>
      {chips.map((c) => {
        const x = cx;
        cx += c.w + 3;
        return (
          <Fragment key={c.label}>
            <Chip x={x} w={c.w} label={c.label} set={c.set} />
          </Fragment>
        );
      })}
      <Label x={cx + 4} y={86.5} size={10} weight={600} tone="body">
        Clear
      </Label>

      <ListRow x={14} y={108} w={412} title="AI payment flow" note="Projects" ai />
      <ListRow x={14} y={146} w={412} title="Payment architecture" note="My documents" ai />
    </Scene>
  );
}

/** The card view inside a folder: the List / Card toggle set to cards, a subfolder's preview mosaic
 *  with its +N tile, and document cards with a favourite star. */
export function CardViewGrid() {
  return (
    <Scene w={420} h={200} bg="plain">
      <Label x={16} y={26} size={13} weight={700} tone="strong">
        Projects
      </Label>
      <Label x={16} y={46} size={10} tone="muted">
        My documents › Projects
      </Label>
      <Button x={298} y={15} w={66} h={22} label="Create" />
      <ViewToggle x={370} y={15} />
      <FolderCard x={16} y={62} w={122} h={124} title="Sprint notes" meta="6 items" more={3} />
      <DocCard x={148} y={62} w={122} h={124} title="Roadmap" meta="2h ago" thumb={1} star />
      <DocCard x={280} y={62} w={122} h={124} title="Data model" meta="Yesterday" thumb={2} />
    </Scene>
  );
}

/** The Change Folder dialog: the destination browser opened at the space, a folder selected, the
 *  New Subfolder entry following the selection, and Move here. */
export function MoveToFolderScene() {
  const x = 44;
  const y = 12;
  const w = 312;
  const row = (ry: number, label: string, opts: { selected?: boolean; glyph?: GlyphKind } = {}) => (
    <g key={label}>
      <rect
        x={x + 14}
        y={ry}
        width={w - 28}
        height={24}
        rx={6}
        className={opts.selected ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-200'}
        strokeWidth={1.2}
      />
      <g transform={`translate(${x + 30} ${ry + 12})`}>
        <Glyph kind={opts.glyph ?? 'folder'} active={opts.selected} />
      </g>
      <Label
        x={x + 44}
        y={ry + 13}
        size={10}
        weight={opts.selected ? 700 : 500}
        tone={opts.selected ? 'accent' : 'body'}
      >
        {label}
      </Label>
    </g>
  );
  return (
    <Scene w={400} h={250}>
      <rect x={0} y={0} width={400} height={250} className="fill-slate-900/10" />
      <rect
        x={x}
        y={y}
        width={w}
        height={226}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <Label x={x + 16} y={y + 20} size={13} weight={700} tone="strong">
        Move “Roadmap”
      </Label>
      <Label x={x + 16} y={y + 37} size={10} tone="muted">
        Pick a destination folder or team.
      </Label>
      <line
        x1={x}
        y1={y + 50}
        x2={x + w}
        y2={y + 50}
        className="stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={x + 16} y={y + 64} size={10} weight={600} tone="accent">
        ‹ My documents
      </Label>
      {row(y + 76, 'Projects', { selected: true })}
      {row(y + 104, 'Workshops')}
      {row(y + 132, 'New Subfolder', { glyph: 'plus' })}
      <line
        x1={x}
        y1={y + 180}
        x2={x + w}
        y2={y + 180}
        className="stroke-slate-200"
        strokeWidth={1.5}
      />
      <Button x={x + w - 166} y={y + 190} w={70} h={24} label="Cancel" />
      <Button x={x + w - 88} y={y + 190} w={74} h={24} label="Move here" variant="primary" />
    </Scene>
  );
}

/** A folder's menu with Use as default for open: the "New documents that open as" list, one
 *  checkable entry per kind of new document. */
export function UseAsDefaultScene() {
  const mx = 16;
  const my = 16;
  const mw = 156;
  const items = ['Rename', 'New Subfolder', 'Change Folder', 'Use as default for'];
  const kinds = [
    'Diagrams',
    'Whiteboards',
    'Illustrate pages',
    'Plan boards',
    'Event Storming boards',
    'Retrospectives',
    'Kanban boards',
  ];
  const ticked = new Set(['Whiteboards', 'Retrospectives']);
  const fx = 180;
  const fy = 72;
  const fw = 222;
  return (
    <Scene w={420} h={250} bg="plain">
      {/* The folder menu */}
      <rect
        x={mx}
        y={my}
        width={mw}
        height={150}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={mx + 12} y={my + 16} size={10} weight={700} tone="strong">
        Workshops
      </Label>
      <line
        x1={mx}
        y1={my + 28}
        x2={mx + mw}
        y2={my + 28}
        className="stroke-slate-200"
        strokeWidth={1}
      />
      {items.map((it, i) => {
        const ry = my + 32 + i * 22;
        const on = i === 3;
        return (
          <g key={it}>
            {on && (
              <rect x={mx + 4} y={ry} width={mw - 8} height={22} rx={5} className="fill-brand-50" />
            )}
            <Label
              x={mx + 12}
              y={ry + 12}
              size={10}
              weight={on ? 600 : 400}
              tone={on ? 'accent' : 'body'}
            >
              {it}
            </Label>
            {on && (
              <Label x={mx + mw - 14} y={ry + 12} size={10} tone="accent">
                ›
              </Label>
            )}
          </g>
        );
      })}
      <line
        x1={mx}
        y1={my + 124}
        x2={mx + mw}
        y2={my + 124}
        className="stroke-slate-200"
        strokeWidth={1}
      />
      <Label x={mx + 12} y={my + 137} size={10} className="fill-rose-600">
        Delete
      </Label>

      {/* The flyout */}
      <rect
        x={fx}
        y={fy}
        width={fw}
        height={170}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={fx + 12} y={fy + 15} size={10} weight={700} tone="muted">
        New documents that open as
      </Label>
      {kinds.map((k, i) => {
        const ry = fy + 26 + i * 20;
        const on = ticked.has(k);
        return (
          <g key={k}>
            <rect
              x={fx + 12}
              y={ry + 4}
              width={12}
              height={12}
              rx={3}
              className={on ? 'fill-brand-500 stroke-brand-600' : 'fill-white stroke-slate-300'}
              strokeWidth={1.2}
            />
            {on && (
              <path
                d={`M${fx + 15} ${ry + 10} l2.5 2.5 l4.5 -5`}
                className="stroke-white help-art-as-drawn"
                strokeWidth={1.6}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            <Label
              x={fx + 32}
              y={ry + 11}
              size={10}
              tone={on ? 'strong' : 'body'}
              weight={on ? 600 : 400}
            >
              {k}
            </Label>
          </g>
        );
      })}
    </Scene>
  );
}
