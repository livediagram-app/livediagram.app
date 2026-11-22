// A knowledgebase structure's picture (docs/specs/030-knowledgebase/describe-to-set-up.md "The start screen", "A
// card's picture"): the knowledgebase it makes, as a miniature liveknowledge window on a wash of its group's colour.
// The page tree at the left in the structure's real titles, its first page with subpages chosen and opened; that
// page at the right, a cover band in the group's colour, the structure's emblem as its page icon over the cover's
// edge, its title, its first heading and a few lines of writing. Drawn in the theme's own colours in light and dark
// (never a re-lit art tile), in real text, and small: sixteen nodes a card, its emblem drawn as a mask, as a start
// draws up to thirty-four at once. The editor's start cards and the landing gallery's draw it; StructureEmblem is the emblem
// alone, on Home's tiles. Decorative: aria-hidden, the card names itself.
import type { CSSProperties } from 'react';
import { iconPrimsMarkup, type IconPrim } from '@liveworkspace/icons';
import { Prims } from '@liveworkspace/ui';
import {
  BLANK_EMBLEM,
  BLANK_TONE,
  DESCRIBE_EMBLEM,
  DESCRIBE_TONE,
  GROUP_TONES,
  STRUCTURE_EMBLEMS,
  type StructureTone,
} from './structure-tones';

/** A page of a structure as the picture reads it (@liveknowledge/knowledge's StructurePage fits). */
export type StructureArtPage = {
  title: string;
  headings?: readonly string[];
  pages: readonly StructureArtPage[];
};

/** What the picture draws: a structure (its id, group and pages), or the start's Blank and Describe cards. */
export type StructureArtProps =
  | { kind: 'structure'; id: string; group: string; pages: readonly StructureArtPage[] }
  | { kind: 'blank' }
  | { kind: 'describe' };

// The tree's rows: at most six fit the window at a desktop card's height.
const MAX_ROWS = 6;

// A row is a page's title, or (`pending`, Describe to Set Up's pages to come) a placeholder that wide.
type Row = { title: string; child: boolean; chosen: boolean; pending?: string };

/** The tree's rows: each top page, the first with subpages chosen and opened on up to two of them. */
export function structureArtRows(pages: readonly StructureArtPage[]): {
  rows: Row[];
  chosen: StructureArtPage | undefined;
} {
  const open = Math.max(
    0,
    pages.findIndex((p) => p.pages.length > 0),
  );
  const rows: Row[] = [];
  pages.forEach((page, i) => {
    rows.push({ title: page.title, child: false, chosen: i === open });
    if (i === open)
      for (const sub of page.pages.slice(0, 2))
        rows.push({ title: sub.title, child: true, chosen: false });
  });
  return { rows: rows.slice(0, MAX_ROWS), chosen: pages[open] };
}

// A small stable number from a structure's id, so each cover catches its light at its own angle.
function seed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function toneStyle(tone: StructureTone, id: string): CSSProperties {
  const s = seed(id);
  return {
    '--kb-50': tone[50],
    '--kb-100': tone[100],
    '--kb-300': tone[300],
    '--kb-400': tone[400],
    '--kb-500': tone[500],
    '--kb-600': tone[600],
    '--kb-700': tone[700],
    '--kb-angle': `${100 + (s % 7) * 12}deg`,
    '--kb-glow': `${18 + ((s >> 3) % 5) * 16}%`,
  } as CSSProperties;
}

// An emblem as a CSS mask: the glyph's own SVG as a data URL, made once a glyph (at most thirty-six of them).
const masks = new Map<readonly IconPrim[], string>();
export function emblemMask(prims: readonly IconPrim[]): string {
  let mask = masks.get(prims);
  if (!mask) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPrimsMarkup(prims)}</svg>`;
    mask = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    masks.set(prims, mask);
  }
  return mask;
}

/** An emblem: a Lucide glyph on the 24-unit grid, stroked in the text colour. */
export function EmblemGlyph({ prims, size }: { prims: readonly IconPrim[]; size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <Prims prims={prims} />
    </svg>
  );
}

// The tile: the window's frame. Its wash, the tone's palest steps in light and a breath of it on the dark card, bleeds
// out over the padding of whatever frame holds it (a start card's picture panel is p-3, a phone's p-1.5), so the
// picture fills the panel to its rounded edge rather than sitting in a second frame. A narrow tile (a phone's start
// card, under 11rem) drops the tree and lets the page fill the window, by the tile's own width, so a wide card on a
// phone (the landing gallery's) keeps it.
const TILE = '@container relative block h-full w-full';
const WASH =
  'absolute -inset-3 bg-[linear-gradient(150deg,var(--kb-50),var(--kb-100))] max-sm:-inset-1.5 dark:bg-[linear-gradient(150deg,color-mix(in_srgb,var(--kb-500)_20%,transparent),color-mix(in_srgb,var(--kb-500)_6%,transparent))]';
// The window, its foot running off the tile's edge. It lifts with the card's hover (StartCard is the `group`).
const WINDOW =
  'absolute inset-x-1 top-1 -bottom-3 flex overflow-hidden rounded-t-[7px] border border-b-0 border-slate-900/10 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.06),0_10px_24px_-10px_color-mix(in_srgb,var(--kb-700)_55%,transparent)] transition-transform duration-micro ease-out group-hover:-translate-y-[3px] group-focus-visible:-translate-y-[3px] motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 motion-reduce:group-focus-visible:translate-y-0 @max-[11rem]:inset-x-0.5 @max-[11rem]:top-0.5 @max-[11rem]:-bottom-1.5 @max-[11rem]:rounded-t-[5px] dark:border-white/10 dark:bg-slate-900 dark:shadow-[0_10px_24px_-10px_rgb(0_0_0/0.7)]';
const SIDEBAR =
  'flex w-[40%] shrink-0 flex-col gap-px border-r border-slate-900/[0.06] bg-slate-50 px-1 py-1.5 @max-[11rem]:hidden dark:border-white/[0.06] dark:bg-white/[0.03]';
const ROW =
  'block truncate rounded-[3px] px-1 text-[7.5px] leading-[11px] text-slate-500 dark:text-slate-400';
// A top page's row has a page mark before it; a subpage's sits in from its parent on a guide.
const ROW_TOP = `${ROW} before:mr-[3px] before:inline-block before:h-[5px] before:w-[4px] before:rounded-[1px] before:border before:border-current before:align-[-0.5px] before:opacity-60`;
const ROW_CHILD = `${ROW} ml-[5px] rounded-l-none border-l border-slate-900/10 pl-[5px] dark:border-white/10`;
const ROW_CHOSEN =
  'bg-[color-mix(in_srgb,var(--kb-500)_16%,transparent)] font-semibold !text-[var(--kb-700)] dark:bg-[color-mix(in_srgb,var(--kb-400)_18%,transparent)] dark:!text-[var(--kb-300)]';
const COVER =
  'relative block h-[24px] overflow-hidden bg-[radial-gradient(circle_at_var(--kb-glow)_0%,rgb(255_255_255/0.5),transparent_62%),linear-gradient(var(--kb-angle),var(--kb-300),var(--kb-600))] @max-[11rem]:h-5 dark:opacity-85';
// The emblem again, large and faint in the cover's corner: what sets a group's four covers apart at a glance.
// Both are drawn as masks over a fill (emblemMask), so an emblem costs no nodes of its own.
const WATERMARK =
  "after:absolute after:-right-1.5 after:-top-2.5 after:h-11 after:w-11 after:rotate-[-12deg] after:bg-white/35 after:content-[''] after:[mask:var(--kb-mark)_center/contain_no-repeat] dark:after:bg-white/25";
// The page icon, half over the cover's foot: the structure's emblem. It grows a little with the card's hover.
const ICON =
  "absolute left-2 top-[12px] flex h-6 w-6 items-center justify-center rounded-[7px] bg-white before:h-3.5 before:w-3.5 before:bg-[var(--kb-600)] before:content-[''] before:[mask:var(--kb-mark)_center/contain_no-repeat] dark:before:bg-[var(--kb-300)] shadow-[0_1px_3px_rgb(15_23_42/0.2)] ring-1 ring-slate-900/5 transition-transform duration-micro ease-out group-hover:scale-110 group-focus-visible:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-focus-visible:scale-100 @max-[11rem]:left-1.5 @max-[11rem]:top-[9px] @max-[11rem]:h-[22px] @max-[11rem]:w-[22px] @max-[11rem]:rounded-[6px] dark:bg-slate-800 dark:ring-white/10";
const TITLE =
  'block truncate px-2 pt-[15px] text-[9px] font-semibold leading-[12px] text-slate-800 @max-[11rem]:px-1.5 @max-[11rem]:pt-[13px] @max-[11rem]:text-[8px] @max-[11rem]:leading-[10px] dark:text-slate-100';
const HEADING =
  'mt-[3px] block truncate px-2 text-[7px] font-semibold leading-[9px] text-[var(--kb-700)] @max-[11rem]:hidden dark:text-[var(--kb-300)]';
// Lines of writing: three bars drawn by one element's backgrounds, in the text colour.
const LINES =
  'mx-2 mt-[4px] block h-[14px] bg-no-repeat text-slate-200 [background-image:linear-gradient(currentColor,currentColor),linear-gradient(currentColor,currentColor),linear-gradient(currentColor,currentColor)] [background-position:0_0,0_5.5px,0_11px] [background-size:100%_3px,86%_3px,58%_3px] @max-[11rem]:mx-1.5 @max-[11rem]:mt-[5px] dark:text-slate-700';

function Window({
  tone,
  id,
  emblem,
  rows,
  title,
  heading,
  cover = COVER,
  lines = LINES,
  watermark = true,
}: {
  tone: StructureTone;
  id: string;
  emblem: readonly IconPrim[];
  rows: readonly Row[];
  title: string;
  heading?: string | undefined;
  cover?: string;
  lines?: string;
  watermark?: boolean;
}) {
  return (
    <span
      aria-hidden
      data-structure-art={id}
      className={TILE}
      style={{ ...toneStyle(tone, id), '--kb-mark': emblemMask(emblem) } as CSSProperties}
    >
      <span className={WASH} />
      <span className={WINDOW}>
        <span className={SIDEBAR}>
          {rows.map((row, i) =>
            row.pending ? (
              <span
                key={i}
                className={`${PENDING_ROW}${row.child ? ' !ml-[10px]' : ''}`}
                style={{ width: row.pending }}
              />
            ) : (
              <span
                key={i}
                className={`${row.child ? ROW_CHILD : ROW_TOP}${row.chosen ? ` ${ROW_CHOSEN}` : ''}`}
              >
                {row.title}
              </span>
            ),
          )}
        </span>
        <span className="relative block min-w-0 flex-1">
          <span className={watermark ? `${cover} ${WATERMARK}` : cover} />
          <span className={ICON} />
          <span className={TITLE}>{title}</span>
          {heading ? <span className={HEADING}>{heading}</span> : null}
          <span className={lines} />
        </span>
      </span>
    </span>
  );
}

// Describe to Set Up's pages are still to come: its tree and its writing are dashed placeholders.
const DESCRIBE_ROWS: readonly Row[] = ['82%', '64%', '74%', '52%', '68%'].map((pending, i) => ({
  title: '',
  child: i === 2 || i === 3,
  chosen: false,
  pending,
}));
const PENDING_ROW =
  'mx-1 my-[2px] block h-[7px] shrink-0 rounded-[3px] border border-dashed border-[color-mix(in_srgb,var(--kb-500)_50%,transparent)] bg-[color-mix(in_srgb,var(--kb-400)_10%,transparent)]';
const PENDING_LINES =
  'mx-2 mt-[5px] block h-[14px] rounded-[2px] border border-dashed border-[color-mix(in_srgb,var(--kb-500)_45%,transparent)] @max-[11rem]:mx-1.5';
const BLANK_ROWS: readonly Row[] = [{ title: 'Start Here', child: false, chosen: true }];
// An empty page: a caret where the writing starts.
const BLANK_LINES =
  'mx-2 mt-[5px] block h-[11px] w-px bg-[var(--kb-500)] @max-[11rem]:mx-1.5 dark:bg-slate-400';
// Blank Knowledgebase's page has no cover yet: a dashed band where one may go.
const BLANK_COVER =
  'block h-[24px] border-b border-dashed border-slate-300 bg-slate-50 @max-[11rem]:h-5 dark:border-slate-600 dark:bg-white/[0.03]';

export function StructureArt(props: StructureArtProps) {
  if (props.kind === 'blank')
    return (
      <Window
        tone={BLANK_TONE}
        id="blank"
        emblem={BLANK_EMBLEM}
        rows={BLANK_ROWS}
        title="Start Here"
        cover={BLANK_COVER}
        watermark={false}
        lines={BLANK_LINES}
      />
    );
  if (props.kind === 'describe')
    return (
      <Window
        tone={DESCRIBE_TONE}
        id="describe"
        emblem={DESCRIBE_EMBLEM}
        rows={DESCRIBE_ROWS}
        title="Suggested Pages"
        heading="Ready to Review"
        lines={PENDING_LINES}
      />
    );
  const { rows, chosen } = structureArtRows(props.pages);
  return (
    <Window
      tone={GROUP_TONES[props.group] ?? BLANK_TONE}
      id={props.id}
      emblem={STRUCTURE_EMBLEMS[props.id] ?? BLANK_EMBLEM}
      rows={rows}
      title={chosen?.title ?? ''}
      heading={chosen?.headings?.[0] ?? chosen?.pages[0]?.title}
    />
  );
}

/** The emblem alone on its group's colour: Home's Start a Knowledgebase From tiles. */
export function StructureEmblem({ id, group }: { id: string; group: string }) {
  const tone = GROUP_TONES[group] ?? BLANK_TONE;
  return (
    <span
      aria-hidden
      className="flex h-11 w-11 items-center justify-center rounded-xl bg-[linear-gradient(150deg,var(--kb-400),var(--kb-700))] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_6px_14px_-6px_color-mix(in_srgb,var(--kb-700)_70%,transparent)] dark:opacity-90"
      style={toneStyle(tone, id)}
    >
      <EmblemGlyph prims={STRUCTURE_EMBLEMS[id] ?? BLANK_EMBLEM} size={20} />
    </span>
  );
}
