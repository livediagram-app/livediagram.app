'use client';

// The call's item in the corner card (docs/specs/012-collaboration/calls-from-items.md "In the call"): Open Item, the
// item's logo and name, bringing back the tab it was started from (or opening it); Invite for an account at Participant
// or above in the Space (a Viewer of it watches, Work Tracker 1458); Wrap Up for the host. Drawn only in a Space that is a call, so every other Space shows nothing new.
// Invite and Wrap Up load on their first open.
import { lazy, Suspense, useState } from 'react';
import { itemTabName, type SpaceCall } from '@liveworkspace/index-client';
import { HoverCard, lucideGlyph } from '@liveworkspace/ui';
import { lucideClipboardCheck, lucideMail } from '@liveworkspace/icons/lucide';
import {
  CORNER_BTN,
  CORNER_TONE,
} from '@liveworkspace/workbench/components/chrome/EditorCornerActions';
import { ItemAppMark } from '@liveworkspace/workbench/components/item-call/ItemAppMark';
import { focusOrOpen } from '@liveworkspace/index-client/browser';
import type { Tab } from '@livehuddle/document';
import { track } from '@/lib/telemetry';

const InviteDialog = lazy(() =>
  import('./InviteDialog').then((m) => ({ default: m.InviteDialog })),
);
const WrapUpDialog = lazy(() =>
  import('./WrapUpDialog').then((m) => ({ default: m.WrapUpDialog })),
);

const InviteGlyph = lucideGlyph(lucideMail, 14);
const WrapUpGlyph = lucideGlyph(lucideClipboardCheck, 14);

// The item's name in the card: cut at 22 characters, the whole in its hover card.
const NAME_MAX = 22;
export const shortName = (title: string): string => {
  const name = title.trim() || 'Untitled';
  return name.length > NAME_MAX ? `${name.slice(0, NAME_MAX - 1).trimEnd()}…` : name;
};

/** Open Item: the item's own tab, brought back, or opened when it has gone. */
export function openCallItem(call: Pick<SpaceCall, 'item'>): void {
  track('UI', 'Opened', 'CallItem');
  if (!focusOrOpen(itemTabName(call.item.id), call.item.link))
    window.open(call.item.link, '_blank', 'noopener');
}

export function CallItemCard({
  call,
  spaceId,
  accountId,
  mayInvite,
  tabs,
  activeTabId,
  onSent,
}: {
  call: SpaceCall;
  spaceId: string;
  // An account (a guest, null, joins only).
  accountId: string | null;
  // The session's role in the Space is Participant or above: a Viewer invites no one, as the index refuses it.
  mayInvite: boolean;
  // The Space's floors, for Wrap Up's draft and its actions (the floor on show).
  tabs: readonly Tab[];
  activeTabId: string;
  // A summary was sent: read the call again.
  onSent: () => void;
}) {
  const [open, setOpen] = useState<'invite' | 'wrap-up' | null>(null);
  return (
    <>
      <HoverCard
        title={`Open ${call.item.title || 'Untitled'}`}
        description={`This call is about this ${call.item.app} item. Open it in its own tab.`}
      >
        <button
          type="button"
          onClick={() => openCallItem(call)}
          data-call-item=""
          className={`${CORNER_BTN} ${CORNER_TONE} max-w-56`}
        >
          <ItemAppMark app={call.item.app} />
          <span className="truncate phone:sr-only [[data-compact]_&]:sr-only">
            {shortName(call.item.title)}
          </span>
        </button>
      </HoverCard>
      {accountId && mayInvite ? (
        <HoverCard
          title="Invite"
          description="Ask people who can open the item to join. They get it in their Inbox."
        >
          <button
            type="button"
            onClick={() => setOpen('invite')}
            className={`${CORNER_BTN} ${CORNER_TONE}`}
          >
            <InviteGlyph />
            <span className="phone:sr-only [[data-compact]_&]:sr-only">Invite</span>
          </button>
        </HoverCard>
      ) : null}
      {call.host && accountId ? (
        <HoverCard
          title="Wrap Up"
          description="Send a summary to a knowledgebase and the actions to a plan, both linked to the item."
        >
          <button
            type="button"
            onClick={() => setOpen('wrap-up')}
            className={`${CORNER_BTN} ${CORNER_TONE}`}
          >
            <WrapUpGlyph />
            <span className="phone:sr-only [[data-compact]_&]:sr-only">Wrap Up</span>
          </button>
        </HoverCard>
      ) : null}
      <Suspense fallback={null}>
        {open === 'invite' && accountId && mayInvite ? (
          <InviteDialog
            call={call}
            spaceId={spaceId}
            accountId={accountId}
            onClose={() => setOpen(null)}
          />
        ) : null}
        {open === 'wrap-up' && accountId ? (
          <WrapUpDialog
            call={call}
            spaceId={spaceId}
            accountId={accountId}
            tabs={tabs}
            activeTabId={activeTabId}
            onClose={() => setOpen(null)}
            onSent={onSent}
          />
        ) : null}
      </Suspense>
    </>
  );
}
