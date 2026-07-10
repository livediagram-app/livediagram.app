import { Button } from '@livediagram/ui';
import type { ShareLink } from '@/lib/api-client';
import { buildEmbedSnippet, embedUrlFor } from '@/lib/embed';
import { liveImageHtml, liveImageMarkdown, liveImageUrlFor } from '@/lib/live-image';
import { formatTimeLeftCompact } from '@/lib/relative-time';
import { track } from '@/lib/telemetry';
import { Tooltip } from '@/components/primitives/Tooltip';
import { ShareCopyMenu } from './ShareCopyMenu';
import { TrashIcon } from '@/components/panels/explorer-icons';
import { CodeGlyph, EXPIRY_LABELS, ImageGlyph, LinkIcon } from './share-dialog-parts';

// One ACTIVE share-link card (spec/04 + spec/33 + spec/34 + spec/54),
// lifted out of ShareDialog: the role + time-left badges and the
// selectable URL on line 1, then Copy / Embed / Live image (with the
// per-tab picker) and the far-edge revoke on line 2. All mutations and
// the live-image tab selection come through the dialog's handlers.
export function ActiveShareLinkRow({
  link,
  now,
  origin,
  copiedCode,
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
}: {
  link: ShareLink;
  now: number;
  origin: string;
  copiedCode: string | null;
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
}) {
  return (
    <li
      key={link.code}
      className="flex flex-col gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800/60"
    >
      {/* Line 1: what the link is + where it points. The
                  URL gets the row's spare width so it stays
                  readable as badges accumulate. */}
      <div className="flex items-center gap-2">
        <span
          className={
            link.role === 'edit'
              ? 'inline-flex shrink-0 items-center rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-800 dark:bg-brand-500/20 dark:text-brand-200'
              : 'inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:bg-slate-700 dark:text-slate-200'
          }
        >
          {link.role === 'edit' ? 'Edit' : 'View'}
        </span>
        {link.expiresAt !== null ? (
          <Tooltip
            title="Expiring link"
            description={`Created with a ${
              link.expiry === 'never' ? '' : EXPIRY_LABELS[link.expiry]
            } lifetime. When it runs out the link stops working and moves to Inactive.`}
          >
            <span className="inline-flex shrink-0 items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
              {formatTimeLeftCompact(link.expiresAt - now)}
            </span>
          </Tooltip>
        ) : null}
        <input
          readOnly
          value={shareUrlFor(link.code)}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-slate-700 outline-none focus:border-brand-400 dark:text-slate-300"
        />
      </div>
      {/* Line 2: actions. Copy is the everyday one and
                  keeps the filled style; Embed (spec/33) stays a
                  labelled button so it's discoverable; revoke
                  sits apart at the far edge. */}
      <div className="flex items-center gap-2">
        <Button onClick={() => onCopy(link.code)} size="xs" className="shadow-sm">
          {copiedCode === link.code ? 'Copied' : 'Copy link'}
        </Button>
        {/* Embed (spec/33): copy the embed as a raw URL or an
                    <iframe> snippet. Embeds honour the link's role,
                    so the tooltip says which one this row hands out. */}
        <ShareCopyMenu
          label="Embed"
          tooltipTitle="Embed"
          tooltipDescription={`Copy an embed of this diagram as a URL or an <iframe> snippet for wikis, Notion, and docs. ${
            link.role === 'edit'
              ? 'This edit link embeds an editable canvas.'
              : 'This view link embeds a read-only canvas.'
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
        {/* Live image (spec/54 + spec/67): an <img>-able SVG
                    URL. Hidden while a password is set — an <img>
                    can't supply one, so the server refuses an
                    image for gated shares and offering it here
                    would mislead. */}
        {sharePassword ? null : (
          <ShareCopyMenu
            label="Live image"
            tooltipTitle="Live image"
            tooltipDescription="An <img>-able SVG URL that re-renders this diagram, so an embed in a README, wiki, or doc stays up to date."
            trackType="LiveImage"
            header={
              // Per-tab picker (spec/54): only worth showing
              // when there's more than one tab. Selecting the
              // first tab clears back to the cached default
              // (null → no `?tab=`).
              tabs.length > 1 ? (
                <label className="flex items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Tab
                  <select
                    value={liveImageTabId ?? firstTabId ?? ''}
                    onChange={(e) => {
                      const id = e.target.value;
                      const next = id === firstTabId ? null : id;
                      setLiveImageTabId(next);
                      if (next) track('UI', 'Selected', 'LiveImageTab');
                    }}
                    className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {tabs.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null
            }
            items={[
              {
                label: 'Copy image URL',
                icon: <ImageGlyph />,
                text: liveImageUrlFor(origin, link.code, liveImageTabParam),
                what: 'image URL',
              },
              {
                label: 'Copy Markdown',
                icon: <ImageGlyph />,
                text: liveImageMarkdown(origin, link.code, liveImageTabParam),
                what: 'Markdown',
              },
              {
                label: 'Copy HTML',
                icon: <ImageGlyph />,
                text: liveImageHtml(origin, link.code, liveImageTabParam),
                what: 'HTML',
              },
            ]}
          />
        )}
        <span className="flex-1" />
        <Tooltip
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
        </Tooltip>
      </div>
    </li>
  );
}
