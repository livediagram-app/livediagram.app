import { lucideGlyph } from '@liveworkspace/ui';
import {
  lucideBraces,
  lucideCircleAlert,
  lucideCircleCheck,
  lucideClock,
  lucideFilePlus,
  lucideHash,
  lucideMessageSquare,
  lucidePause,
  lucidePlay,
  lucideSend,
  lucideSquareKanban,
  lucideUser,
  lucideUsers,
} from '@liveworkspace/icons/lucide';
import type { WebhookKind } from '@liveworkspace/index-client';
import { listedApps } from '@/lib/apps';
import { AppLogo } from '@/components/landing/AppLogo';
import type { EventGroupId } from './webhooks-api';

// Settings › Webhooks' marks (liveworkspace/docs/specs/010-site/site.md "Settings", Webhooks): each destination's
// tile, the glyphs on its buttons and pickers, and an app named by its logo. The repo carries no Slack or Teams
// logo, so each destination is a plain glyph on a tile in that tool's own colour: Slack's hash on its aubergine,
// Teams' people on its indigo, a service's braces on slate. Every glyph is a vendored Lucide one.

export const SendGlyph = /* @__PURE__ */ lucideGlyph(lucideSend, 15);
export const PauseGlyph = /* @__PURE__ */ lucideGlyph(lucidePause, 15);
export const PlayGlyph = /* @__PURE__ */ lucideGlyph(lucidePlay, 15);
export const DeliveredGlyph = /* @__PURE__ */ lucideGlyph(lucideCircleCheck, 14);
export const FailedGlyph = /* @__PURE__ */ lucideGlyph(lucideCircleAlert, 14);
export const WaitingGlyph = /* @__PURE__ */ lucideGlyph(lucideClock, 14);
export const PersonGlyph = /* @__PURE__ */ lucideGlyph(lucideUser, 16);
export const TeamGlyph = /* @__PURE__ */ lucideGlyph(lucideUsers, 16);

const HashGlyph = /* @__PURE__ */ lucideGlyph(lucideHash, 18);
const PeopleGlyph = /* @__PURE__ */ lucideGlyph(lucideUsers, 18);
const BracesGlyph = /* @__PURE__ */ lucideGlyph(lucideBraces, 18);

const KIND_MARKS: Record<WebhookKind, { Glyph: typeof HashGlyph; tile: string }> = {
  slack: { Glyph: HashGlyph, tile: 'bg-[#4a154b] text-white shadow-[#4a154b]/25' },
  teams: { Glyph: PeopleGlyph, tile: 'bg-[#5059c9] text-white shadow-[#5059c9]/25' },
  json: {
    Glyph: BracesGlyph,
    tile: 'bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-slate-900/20 dark:from-slate-500 dark:to-slate-700',
  },
};

/** A destination's tile: 40px on a webhook's row, 32px in the picker. Decorative: its name is beside it. */
export function KindMark({ kind, size = 'md' }: { kind: WebhookKind; size?: 'sm' | 'md' }) {
  const { Glyph, tile } = KIND_MARKS[kind];
  return (
    <span
      aria-hidden
      data-kind-mark={kind}
      className={`flex shrink-0 items-center justify-center shadow-sm ${tile} ${
        size === 'md' ? 'size-10 rounded-xl' : 'size-8 rounded-lg [&_svg]:size-4'
      }`}
    >
      <Glyph />
    </span>
  );
}

const GROUP_GLYPHS: Record<EventGroupId, typeof HashGlyph> = {
  items: /* @__PURE__ */ lucideGlyph(lucideFilePlus, 15),
  sharing: /* @__PURE__ */ lucideGlyph(lucideMessageSquare, 15),
  work: /* @__PURE__ */ lucideGlyph(lucideSquareKanban, 15),
};

/** An event group's glyph, beside its heading. */
export function GroupGlyph({ id }: { id: EventGroupId }) {
  const Glyph = GROUP_GLYPHS[id];
  return <Glyph />;
}

// The apps, by the brand package's name, as the home page lists them.
const APPS = new Map(listedApps().map((app) => [app.id.replace(/\.app$/, ''), app]));

/** An app named by its logo and wordmark, at the size of the words around it, never as plain text. */
export function AppName({ app }: { app: string }) {
  const listed = APPS.get(app);
  return listed ? <AppLogo app={listed} size="xs" /> : <span>{app}</span>;
}

/** Every app whose work a webhook hears about, by their logos. */
export function EveryAppName() {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {[...APPS.values()].map((app) => (
        <AppLogo key={app.id} app={app} size="xs" />
      ))}
    </span>
  );
}
