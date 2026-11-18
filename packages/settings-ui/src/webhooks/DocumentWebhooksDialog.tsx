'use client';

import { useId } from 'react';
import { Dialog } from '@liveworkspace/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { webhooksHeroArt } from '@liveworkspace/ui/dialog-hero-art/webhooks';
import type { App, IndexClient, ShareAccess } from '@liveworkspace/index-client';
import { DocumentWebhooks } from './DocumentWebhooks';

// The Webhooks dialog (liveworkspace/docs/specs/004-index/webhooks.md "Managing them"), one shell for every place
// that opens it: an item's ⋯ menu in any Explorer, and the open document's own menu in each editor. On the dialog hero
// header (dialog-hero-header.md), a payload leaving along a send line to an endpoint, titled by the document itself,
// so it reads at once whose webhooks they are: "Webhooks for “<name>”".

// A name in a sentence, isolated (FSI … PDI), so a right-to-left one never turns the words around it.
const quoted = (name: string) => `“⁨${name}⁩”`;

export function DocumentWebhooksDialog({
  onClose,
  client,
  itemId,
  app,
  title,
  share,
}: {
  onClose: () => void;
  client: IndexClient;
  itemId: string;
  app: App;
  // The document's name as its owner sees it.
  title: string;
  // The link the page opened it through, for an Editor who isn't its owner or in its team.
  share?: ShareAccess | null;
}) {
  const name = title || 'Untitled';
  const titleId = useId();
  const heading = `Webhooks for ${quoted(name)}`;
  return (
    <Dialog
      open
      onClose={onClose}
      titleId={titleId}
      // Wide enough for the add form's three destination cards side by side.
      size="2xl"
      className="sm:max-h-[min(46rem,calc(100dvh-4rem))]"
    >
      <HeroDialogHeader
        art={webhooksHeroArt}
        titleId={titleId}
        // A long name is cut short; the whole of it shows on hover.
        title={<span title={heading}>{heading}</span>}
        onClose={onClose}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <DocumentWebhooks client={client} itemId={itemId} app={app} share={share ?? null} />
      </div>
    </Dialog>
  );
}
