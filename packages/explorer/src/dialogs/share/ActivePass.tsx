'use client';

// One live share link, drawn as a pass. Its body: the link with Copy inside the field; what the pass is printed with
// (the tabs it opens, how long it is valid, ticking down, and the password tag); and the other ways to hand it over
// (Embed, Live image, where the host serves them) with Revoke at the far edge, which asks first.

import { useState } from 'react';
import type { ShareLink } from '@liveworkspace/index-client';
import { timeLeftCompact } from '../../time';
import { Button } from '@liveworkspace/ui';
import { CheckIcon, CopyIcon, LinkIcon, LockIcon, TrashIcon } from '../../ui/icons';
import { CopyMenu } from './CopyMenu';
import { CodeGlyph, ImageGlyph, MarkdownGlyph, SmallClockGlyph } from './glyphs';
import { embedSnippet, liveImageHtml, liveImageMarkdown, type ShareHandOver } from './handover';
import { PassTicket, usePassExit } from './PassTicket';
import { LIFETIMES, PASS_BIN, SELECT, ScopeOptions, type ShareTab } from './parts';
import type { ShareNotify, ShareTelemetry } from './types';

const META =
  'text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

export function ActivePass({
  link,
  url,
  now,
  copied,
  fresh,
  highlight,
  busy,
  passwordSet,
  tabs,
  handOver,
  imageTabId,
  setImageTabId,
  word,
  notify,
  onTelemetry,
  onCopy,
  onRevoke,
  onRescope,
}: {
  link: ShareLink;
  url: string;
  now: number;
  copied: boolean;
  fresh: boolean;
  highlight: boolean;
  busy: boolean;
  passwordSet: boolean;
  tabs: ShareTab[];
  handOver: ShareHandOver;
  // Which tab every pass's live image draws (null: the first, served from its cached snapshot).
  imageTabId: string | null;
  setImageTabId: (id: string | null) => void;
  word: string;
  notify: ShareNotify;
  onTelemetry?: ShareTelemetry;
  onCopy: () => void;
  onRevoke: () => void;
  // Null where the item has one tab, so there is nothing to choose between.
  onRescope: ((tabId: string | null) => void) | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const exit = usePassExit(onRevoke);
  // A link of one tab draws that tab: the server picks it, so the image's address names none.
  const imageTab = link.tabId !== null ? undefined : (imageTabId ?? undefined);
  const firstTabId = tabs[0]?.id;
  const embedUrl = handOver.embedUrl?.(link);
  const imageUrl = handOver.liveImageUrl?.(link, imageTab);
  const alt = handOver.liveImageAlt ?? `${word} tab`;
  return (
    <PassTicket
      level={link.level}
      code={link.code}
      fresh={fresh}
      highlight={highlight}
      leaving={exit.leaving}
    >
      <div className="relative flex items-center">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Pass link"
          className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-2.5 pr-10 font-mono text-[11px] text-slate-700 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300"
        />
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? 'Copied' : 'Copy link'}
          title={copied ? 'Copied' : 'Copy link'}
          className={`absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md transition ${
            copied
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-slate-400 hover:bg-slate-200/70 hover:text-brand-700 dark:hover:bg-slate-700 dark:hover:text-brand-300'
          }`}
        >
          {copied ? <CheckIcon size={14} /> : <CopyIcon />}
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
          {onRescope ? (
            <span className="inline-flex items-center gap-1.5">
              <span className={META}>Opens</span>
              <select
                className={`${SELECT} max-w-36`}
                value={link.tabId ?? ''}
                onChange={(e) => onRescope(e.target.value || null)}
                disabled={busy}
                aria-label="Tabs this pass opens"
                title="Which tabs this pass opens. A change takes effect at once."
              >
                <ScopeOptions tabs={tabs} />
              </select>
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <span className={META}>Valid</span>
            {link.expiresAt !== null ? (
              <span
                data-share-countdown=""
                title={`Issued for ${LIFETIMES[link.expiry]}. When it runs out the link stops working and moves to Expired, where you can extend it.`}
                className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"
              >
                <SmallClockGlyph />
                {timeLeftCompact(link.expiresAt - now)}
              </span>
            ) : (
              <span className="font-medium">{LIFETIMES.never}</span>
            )}
          </span>
          {passwordSet ? (
            <span
              data-share-password-tag=""
              className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-300"
            >
              <LockIcon size={11} />
              Password
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 sm:flex-1 sm:justify-end">
          {embedUrl ? (
            <CopyMenu
              label="Embed"
              description={`Copy an embed of this ${word} as a URL or an <iframe> for wikis and docs. ${
                link.level === 'edit'
                  ? 'This Editor pass embeds it editable.'
                  : 'This pass embeds it look-only.'
              }`}
              telemetryType="EmbedCode"
              notify={notify}
              onTelemetry={onTelemetry}
              items={[
                { label: 'Copy embed URL', icon: <LinkIcon />, text: embedUrl, what: 'embed URL' },
                {
                  label: 'Copy iframe',
                  icon: <CodeGlyph />,
                  text: embedSnippet(embedUrl),
                  what: 'iframe',
                },
              ]}
            />
          ) : null}
          {imageUrl && !passwordSet ? (
            <CopyMenu
              label="Live image"
              description={`An <img>-able picture that redraws this ${word}, so it stays up to date in a README, wiki or doc.`}
              telemetryType="LiveImage"
              notify={notify}
              onTelemetry={onTelemetry}
              header={
                tabs.length > 1 && link.tabId === null ? (
                  <label className="flex items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Tab
                    <select
                      className={`${SELECT} min-w-0 flex-1`}
                      value={imageTabId ?? firstTabId ?? ''}
                      onChange={(e) => {
                        const next = e.target.value === firstTabId ? null : e.target.value;
                        setImageTabId(next);
                        if (next) onTelemetry?.('Selected', 'LiveImageTab');
                      }}
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
                  text: imageUrl,
                  what: 'image URL',
                },
                {
                  label: 'Copy Markdown',
                  icon: <MarkdownGlyph />,
                  text: liveImageMarkdown(imageUrl, alt),
                  what: 'Markdown',
                },
                {
                  label: 'Copy HTML',
                  icon: <CodeGlyph />,
                  text: liveImageHtml(imageUrl, alt),
                  what: 'HTML',
                },
              ]}
            />
          ) : null}
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={busy || exit.leaving}
            aria-label="Revoke link"
            aria-expanded={confirming}
            title="Revoke link: it stops working at once for everyone holding it."
            className={PASS_BIN}
          >
            <TrashIcon />
          </button>
        </div>
      </div>
      {confirming ? (
        // Revoking cuts off everyone holding the pass and can't be undone (a new pass is a new address), so it asks
        // right beside the bin.
        <div
          role="alertdialog"
          aria-label="Revoke this pass?"
          className="flex flex-wrap items-center gap-2 rounded-lg bg-rose-50 px-2.5 py-2 text-xs text-rose-800 dark:bg-rose-500/10 dark:text-rose-200"
        >
          <span className="min-w-0 flex-1">
            Revoke this pass? The link stops working at once for everyone holding it.
          </span>
          <Button variant="secondary" size="xs" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button
            size="xs"
            onClick={() => {
              setConfirming(false);
              exit.leave();
            }}
          >
            Revoke
          </Button>
        </div>
      ) : null}
    </PassTicket>
  );
}
