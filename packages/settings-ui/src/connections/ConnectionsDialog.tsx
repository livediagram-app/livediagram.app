'use client';

import { useId } from 'react';
import { Dialog } from '@liveworkspace/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { webhooksHeroArt } from '@liveworkspace/ui/dialog-hero-art/webhooks';
import type { App, IndexClient, ShareAccess } from '@liveworkspace/index-client';
import { Connections } from './Connections';

// The Connections dialog (liveworkspace/docs/specs/004-index/webhooks.md "Managing them"), once the Webhooks dialog:
// the shell around the Connections list for the places that still open it by itself (an item's ⋯ menu in an
// Explorer, the open item's Tools in an editor) until each app's Automations screen holds the list as a tab. On the
// dialog hero header (dialog-hero-header.md), titled by the item itself, so it reads at once whose connections they
// are: "Connections for “<name>”".

// A name in a sentence, isolated (FSI … PDI), so a right-to-left one never turns the words around it.
const quoted = (name: string) => `“⁨${name}⁩”`;

export function ConnectionsDialog({
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
  const heading = `Connections for ${quoted(name)}`;
  return (
    <Dialog
      open
      onClose={onClose}
      titleId={titleId}
      // Room for a row's name, state and three buttons on one line.
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
        <Connections client={client} itemId={itemId} app={app} share={share ?? null} />
      </div>
    </Dialog>
  );
}
