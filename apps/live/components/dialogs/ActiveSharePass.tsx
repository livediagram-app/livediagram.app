import { TrashIcon } from '@/components/primitives/explorer-icons';
import {
  Button,
  CheckIcon,
  CopyIcon,
  HoverCard,
  LinkIcon,
  LockIcon,
  Select,
} from '@livediagram/ui';
import type { ShareLink } from '@/lib/api-client';
import { buildEmbedSnippet, embedUrlFor } from '@/lib/embed';
import { liveImageHtml, liveImageMarkdown, liveImageUrlFor } from '@/lib/live-image';
import { formatTimeLeftCompact } from '@/lib/relative-time';
import { track } from '@/lib/telemetry';
import { ShareCopyMenu } from './ShareCopyMenu';
import { SharePassTicket } from './SharePassTicket';
import {
  ClockIcon,
  CodeGlyph,
  EXPIRY_LABELS,
  ImageGlyph,
  ScopeOptions,
} from './share-dialog-parts';

// One ACTIVE share link, drawn as a pass (docs/specs/007-editor/live-app.md "The pass metaphor";
// docs/specs/014-identity/auth-and-guest-access.md + docs/specs/013-workspace/embeds.md +
// docs/specs/013-workspace/share-link-expiry.md + docs/specs/013-workspace/live-image-share.md).
// Three lines on the ticket body: the link and its Copy button; what the pass is printed with
// (tabs it opens, how long it is valid, the password tag); the other hand-over routes (Embed,
// Live image) with Revoke at the far edge. All mutations and the live-image tab selection come
// through the dialog's handlers.
export function ActiveSharePass({
  link,
  now,
  origin,
  copied,
  fresh,
  busy,
  sharePassword,
  tabs,
  liveImageTabId,
  firstTabId,
  liveImageTabParam,
  setLiveImageTabId,
  shareUrlFor,
  onCopy,
  onRevoke,
  onRescope,
}: {
  link: ShareLink;
  now: number;
  origin: string;
  // This pass's Copy button is flashing "Copied".
  copied: boolean;
  // Just issued in this dialog session.
  fresh: boolean;
  busy: boolean;
  // Non-null while the share is password-gated — the Live image offer
  // hides then (an <img> can't supply a password).
  sharePassword: string | null;
  // The diagram's tabs, in bar order, for the Live image tab picker.
  tabs: { id: string; name: string }[];
  liveImageTabId: string | null;
  firstTabId: string | undefined;
  liveImageTabParam: string | undefined;
  setLiveImageTabId: (id: string | null) => void;
  shareUrlFor: (code: string) => string;
  onCopy: (code: string) => void;
  onRevoke: (code: string) => void;
  // Change which tabs this link opens (docs/specs/013-workspace/tab-scoped-share-links.md). Null on a
  // single-tab diagram, where there is nothing to choose between.
  onRescope: ((code: string, tabId: string | null) => void) | null;
}) {
  // A scoped link's live image is always its own tab: the server picks it,
  // so the URL carries no `?tab=` and the picker has nothing to offer.
  const scoped = link.tabId !== null;
  const imageTabParam = scoped ? undefined : liveImageTabParam;
  const metaLabel = 'text-[10px] font-semibold uppercase tracking-wider text-slate-400';
  return (
    <SharePassTicket role={link.role} fresh={fresh}>
      {/* Line 1: the link itself, and the one filled button on the card. */}
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={shareUrlFor(link.code)}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={`${link.role === 'edit' ? 'Edit' : 'View'} pass link`}
          className="min-w-0 flex-1 truncate rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-700 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300"
        />
        <Button onClick={() => onCopy(link.code)} size="xs" className="shrink-0 shadow-sm">
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      {/* Line 2: what the pass is printed with. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
        <span className="inline-flex items-center gap-1.5">
          <span className={metaLabel}>Opens</span>
          {onRescope ? (
            <HoverCard
              title="Tabs"
              description="Which tabs this pass opens. Changing it takes effect at once: anyone using it reloads into the new choice."
            >
              <Select
                size="sm"
                variant="ghost"
                value={link.tabId ?? ''}
                onChange={(e) => onRescope(link.code, e.target.value || null)}
                disabled={busy}
                aria-label={`Tabs link ${link.code} opens`}
                className="max-w-36"
              >
                <ScopeOptions tabs={tabs} />
              </Select>
            </HoverCard>
          ) : (
            <span className="font-medium">All tabs</span>
          )}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className={metaLabel}>Valid</span>
          {link.expiresAt !== null ? (
            <HoverCard
              title="Expiring pass"
              description={`Issued with a ${
                link.expiry === 'never' ? '' : EXPIRY_LABELS[link.expiry]
              } lifetime. When it runs out the link stops working and moves to Expired, where you can extend it.`}
            >
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
                <ClockIcon />
                {formatTimeLeftCompact(link.expiresAt - now)}
              </span>
            </HoverCard>
          ) : (
            <span className="font-medium">Never expires</span>
          )}
        </span>
        {sharePassword ? (
          <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-300">
            <LockIcon size={11} />
            Password
          </span>
        ) : null}
      </div>

      {/* Line 3: the other ways to hand it over, revoke apart at the far edge. */}
      <div className="flex items-center gap-1.5">
        {/* Embed (docs/specs/013-workspace/embeds.md): copy the embed as a raw URL or an
            <iframe> snippet. Embeds honour the link's role, so the hover card
            says which one this pass hands out. */}
        <ShareCopyMenu
          label="Embed"
          hoverCardTitle="Embed"
          hoverCardDescription={`Copy an embed of this diagram as a URL or an <iframe> snippet for wikis, Notion, and docs. ${
            link.role === 'edit'
              ? 'This edit pass embeds an editable canvas.'
              : 'This view pass embeds a read-only canvas.'
          }`}
          trackType="EmbedCode"
          items={[
            {
              label: 'Copy embed URL',
              icon: <LinkIcon />,
              text: embedUrlFor(origin, link.code),
              what: 'embed URL',
            },
            {
              label: 'Copy iframe',
              icon: <CodeGlyph />,
              text: buildEmbedSnippet(origin, link.code),
              what: 'iframe',
            },
          ]}
        />
        {/* Live image (docs/specs/013-workspace/live-image-share.md + docs/specs/006-diagram/diagram-snapshots.md):
            an <img>-able SVG URL. Hidden while a password is set: an <img>
            can't supply one, so the server refuses an image for gated shares
            and offering it here would mislead. */}
        {sharePassword ? null : (
          <ShareCopyMenu
            label="Live image"
            hoverCardTitle="Live image"
            hoverCardDescription="An <img>-able SVG URL that re-renders this diagram, so an embed in a README, wiki, or doc stays up to date."
            trackType="LiveImage"
            header={
              // Per-tab picker (docs/specs/013-workspace/live-image-share.md): only worth showing
              // when there's more than one tab. Selecting the first tab
              // clears back to the cached default (null → no `?tab=`).
              tabs.length > 1 && !scoped ? (
                <label className="flex items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Tab
                  <Select
                    size="sm"
                    value={liveImageTabId ?? firstTabId ?? ''}
                    onChange={(e) => {
                      const id = e.target.value;
                      const next = id === firstTabId ? null : id;
                      setLiveImageTabId(next);
                      if (next) track('UI', 'Selected', 'LiveImageTab');
                    }}
                    className="min-w-0 flex-1"
                  >
                    {tabs.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </label>
              ) : null
            }
            items={[
              {
                label: 'Copy image URL',
                icon: <ImageGlyph />,
                text: liveImageUrlFor(origin, link.code, imageTabParam),
                what: 'image URL',
              },
              {
                label: 'Copy Markdown',
                icon: <ImageGlyph />,
                text: liveImageMarkdown(origin, link.code, imageTabParam),
                what: 'Markdown',
              },
              {
                label: 'Copy HTML',
                icon: <ImageGlyph />,
                text: liveImageHtml(origin, link.code, imageTabParam),
                what: 'HTML',
              },
            ]}
          />
        )}
        <span className="flex-1" />
        <HoverCard
          title="Revoke link"
          description="The URL stops working immediately for everyone holding it."
        >
          <button
            type="button"
            onClick={() => onRevoke(link.code)}
            disabled={busy}
            aria-label="Revoke link"
            className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
          >
            <TrashIcon />
          </button>
        </HoverCard>
      </div>
    </SharePassTicket>
  );
}
