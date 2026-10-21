import type { ShareLinkExpiry, ShareRole } from '@/lib/api-client';
import { Glyph, lucideGlyph } from '@livediagram/ui';
import { lucideClock, lucideEye, lucidePencilLine, lucideVote } from '@livediagram/icons/lucide';

// Presentational parts of the share dialog: the expiry-label lookup, the
// role catalogue every pass surface reads (docs/specs/007-editor/live-app.md
// "The pass metaphor"), and the Embed / Live image glyphs. Split out of
// ShareDialog.
export const EXPIRY_LABELS: Record<Exclude<ShareLinkExpiry, 'never'>, string> = {
  week: '1 week',
  month: '1 month',
  sixMonths: '6 months',
};

// Also what a pass prints beside Valid when it never expires.
export const FOREVER_LABEL = 'Forever';

// The lifetimes a new pass can be issued with (docs/specs/013-workspace/share-link-expiry.md), in the
// order the Valid control shows them. Forever = never expires, the default.
export const LIFETIMES: { value: ShareLinkExpiry; label: string }[] = [
  { value: 'never', label: FOREVER_LABEL },
  { value: 'week', label: '1 week' },
  { value: 'month', label: '1 month' },
  { value: 'sixMonths', label: '6 months' },
];

const EditPassIcon = lucideGlyph(lucidePencilLine, 18);
const ParticipatePassIcon = lucideGlyph(lucideVote, 18);
const ViewPassIcon = lucideGlyph(lucideEye, 18);
export const ClockIcon = lucideGlyph(lucideClock, 12);

// A pass's delete button: bordered like its hand-over buttons beside it, rose on hover.
export const PASS_BIN_CLASS =
  'inline-flex items-center rounded-md border border-slate-200 px-1.5 py-1 text-slate-500 transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:border-rose-400/60 dark:hover:text-rose-300';

// One entry per role. The band colour is the role at a glance, so the
// composer's role card, the pass header band and nothing else use it: brand for
// edit, teal for participate, violet for view (docs/specs/013-workspace/share-roles.md).
// Keyed in LEVEL_ORDER, the cards' order.
export const ROLE_PASS: Record<
  ShareRole,
  {
    // The word printed on the pass header band.
    stamp: string;
    title: string;
    blurb: string;
    Icon: typeof EditPassIcon;
    // Solid fill: the pass header band and the role card's icon tile.
    solid: string;
    // The selected role card's border + tint.
    selected: string;
    // The role picker's row in the role's hue: its title, its hover tint, and its ring and tint once chosen.
    text: string;
    hover: string;
    chosen: string;
    // Create Pass in the role's colour (Button variant "solid"); white text at 4.5:1 or better.
    button: string;
  }
> = {
  edit: {
    stamp: 'Editor',
    title: 'Editor',
    blurb: 'Draws with you in real time.',
    Icon: EditPassIcon,
    solid: 'bg-brand-700 text-white dark:bg-brand-600',
    selected: 'border-brand-500 bg-brand-50/70 dark:border-brand-400 dark:bg-brand-500/10',
    text: 'text-brand-700 dark:text-brand-300',
    hover: 'hover:bg-brand-50 dark:hover:bg-brand-500/10',
    chosen: 'bg-brand-50 ring-1 ring-brand-300 dark:bg-brand-500/15 dark:ring-brand-500/50',
    button: 'bg-brand-700 hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-700',
  },
  participate: {
    stamp: 'Participant',
    title: 'Participant',
    blurb: "Adds stickies, writes and votes. Can't reshape the board.",
    Icon: ParticipatePassIcon,
    // teal-700 under the 10 px bold stamp: 5.47:1 (blueprint "Accessibility").
    solid: 'bg-teal-700 text-white dark:bg-teal-600/60',
    selected: 'border-teal-600 bg-teal-50/70 dark:border-teal-400 dark:bg-teal-500/10',
    text: 'text-teal-800 dark:text-teal-300',
    hover: 'hover:bg-teal-50 dark:hover:bg-teal-500/10',
    chosen: 'bg-teal-50 ring-1 ring-teal-300 dark:bg-teal-500/15 dark:ring-teal-500/50',
    button: 'bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-700',
  },
  view: {
    stamp: 'Viewer',
    title: 'Viewer',
    blurb: "Watches, pans and zooms. Can't comment, vote or change a thing.",
    Icon: ViewPassIcon,
    solid: 'bg-violet-500 text-white dark:bg-violet-500/60',
    selected: 'border-violet-500 bg-violet-50/70 dark:border-violet-400 dark:bg-violet-500/10',
    text: 'text-violet-700 dark:text-violet-300',
    hover: 'hover:bg-violet-50 dark:hover:bg-violet-500/10',
    chosen: 'bg-violet-50 ring-1 ring-violet-300 dark:bg-violet-500/15 dark:ring-violet-500/50',
    button: 'bg-violet-600 hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600',
  },
};

// Menu-item glyphs for the Embed / Live image copy menus.
export function ImageGlyph() {
  return (
    <Glyph size={14} units={16}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <circle cx="6" cy="6.5" r="1.2" />
      <path d="M3 12l3.5-3.5 2.5 2.5 2-2L14 11.5" />
    </Glyph>
  );
}

// Markdown's M-and-down-arrow mark, for the Copy Markdown row.
export function MarkdownGlyph() {
  return (
    <Glyph size={14} units={16}>
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
      <path d="M4 10V6l2 2 2-2v4M11 6v4M9.5 8.5 11 10l1.5-1.5" />
    </Glyph>
  );
}

export function CodeGlyph() {
  return (
    <Glyph size={14} units={16}>
      <path d="M6 5l-3 3 3 3M10 5l3 3-3 3" />
    </Glyph>
  );
}

// The options of a link-scope picker (docs/specs/013-workspace/tab-scoped-share-links.md): All tabs, then
// every tab by name in bar order. '' stands for All tabs.
export function ScopeOptions({ tabs }: { tabs: { id: string; name: string }[] }) {
  return (
    <>
      <option value="">All tabs</option>
      {tabs.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </>
  );
}

// The uppercase section caption the dialog's bands share.
export const SECTION_LABEL =
  'text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';
