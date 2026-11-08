'use client';

import type { ReactNode } from 'react';
import { Dialog, DialogCloseButton } from '@liveworkspace/ui';
import type { App, IndexClient, ShareAccess } from '@liveworkspace/index-client';
import { SettingsSharedGlyph } from '../glyphs';
import { DocumentWebhooks } from './DocumentWebhooks';
import { ITEM } from './webhooks-api';

// The Webhooks dialog (liveworkspace/docs/specs/004-index/webhooks.md "Managing them"), one shell for every place
// that opens it: an item's ⋯ menu in any Explorer, and the open document's own menu in each editor. Headed by the
// document itself, so it reads at once whose webhooks they are and that they are its alone: its thumbnail where the
// host has one, the eyebrow Webhooks, "Webhooks for “<name>”", and "<Kind> · These apply to this <kind> only".

// A name in a sentence, isolated (FSI … PDI), so a right-to-left one never turns the words around it.
const quoted = (name: string) => `“⁨${name}⁩”`;

export function DocumentWebhooksDialog({
  onClose,
  client,
  itemId,
  app,
  title,
  share,
  thumbnail,
  mark,
}: {
  onClose: () => void;
  client: IndexClient;
  itemId: string;
  app: App;
  // The document's name as its owner sees it.
  title: string;
  // The link the page opened it through, for an Editor who isn't its owner or in its team.
  share?: ShareAccess | null;
  // The host's picture of it, and its app's mark beside the kind word (the Explorer's own).
  thumbnail?: ReactNode;
  mark?: ReactNode;
}) {
  const name = title || 'Untitled';
  const kind = ITEM(app).one;
  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel={`Webhooks for ${quoted(name)}`}
      // Wide enough for the add form's three destination cards side by side.
      size="2xl"
      className="sm:max-h-[min(46rem,calc(100dvh-4rem))]"
    >
      <div className="flex shrink-0 items-start gap-3 border-b border-slate-100 px-5 pb-4 pt-5 sm:px-6 dark:border-slate-800">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500 [&>*]:max-h-full [&>*]:max-w-full [&_svg]:h-6 [&_svg]:w-6">
          {thumbnail ?? <SettingsSharedGlyph id="webhooks" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
            Webhooks
          </p>
          <h2
            className="truncate text-base font-semibold text-slate-900 dark:text-slate-100"
            title={`Webhooks for ${quoted(name)}`}
          >
            Webhooks for {quoted(name)}
          </h2>
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            {mark}
            <span>
              {kind} · These apply to this {kind.toLowerCase()} only
            </span>
          </p>
        </div>
        <DialogCloseButton onClick={onClose} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DocumentWebhooks client={client} itemId={itemId} app={app} share={share ?? null} />
      </div>
    </Dialog>
  );
}
