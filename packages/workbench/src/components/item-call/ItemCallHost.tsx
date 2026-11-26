'use client';

// The editor's one Start a Call Here host (liveworkspace/docs/specs/004-index/item-calls.md): mounted beside the
// editor, it names the open item to the calls' store (read once, then on the room's word only), names this tab for the
// call's Open Item, puts Meetings in Tools (Collaborate), and holds the Start a Call popover Call opens (Work Tracker
// 1470). Nothing at all for a session that can't call (Offline, an embed, the Community, livehuddle's own Spaces): no
// read, no button, no row. Meetings' dialog and the popover each load on their first open.
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { App, ShareAccess } from '@liveworkspace/index-client';
import { lucideGlyph } from '@liveworkspace/ui';
import { lucideVideo } from '@liveworkspace/icons/lucide';
import { workbench } from '../../bindings';
import type { ChromeToolsItem } from '../chrome/ChromeToolsMenu';
import { usePublishToolsItems } from '../chrome/tools-door';
import { resetCallChooser, useCallChooser } from './call-chooser-store';
import { setCallSource } from './item-call-store';
import { loadStartCallPopover } from './start-call-chunk';
import { nameItemTab } from '@liveworkspace/index-client/browser';

const MeetingsDialog = lazy(() =>
  import('./MeetingsDialog').then((m) => ({ default: m.MeetingsDialog })),
);

const StartCallPopover = lazy(() =>
  loadStartCallPopover().then((m) => ({ default: m.StartCallPopover })),
);

const MeetingsIcon = lucideGlyph(lucideVideo, 16);

/** Whether this session may see calls at all: an item on the server, in the app's own editor. */
export function canCall(session: {
  offline?: boolean;
  embed?: boolean;
  community?: boolean;
}): boolean {
  return !session.offline && !session.embed && !session.community;
}

export function ItemCallHost({
  app,
  itemId,
  title,
  share = null,
  signedIn,
  enabled,
}: {
  app: App;
  // The open item, null until it is known.
  itemId: string | null;
  title: string;
  // The link it was opened through, so the calls read with the same access the editor holds.
  share?: ShareAccess | null;
  // An account: may start a call. A guest through a link joins only.
  signedIn: boolean;
  // canCall(...) for this session.
  enabled: boolean;
}) {
  const live = enabled && itemId && app !== 'livehuddle' ? itemId : null;
  const code = share?.code ?? null;
  const [meetings, setMeetings] = useState(false);

  useEffect(() => {
    if (!live) return;
    nameItemTab(live);
  }, [live]);

  useEffect(() => {
    setCallSource(
      live ? { app, id: live, title, share: code ? { code } : null, canStart: signedIn } : null,
    );
  }, [live, app, title, code, signedIn]);

  useEffect(
    () => () => {
      setCallSource(null);
      resetCallChooser();
    },
    [],
  );
  // Another item (or none) closes a popover left open for the last one.
  useEffect(() => resetCallChooser, [live]);
  const chooser = useCallChooser();

  const rows = useMemo<readonly ChromeToolsItem[]>(
    () =>
      live
        ? [
            {
              id: 'meetings',
              group: 'collaborate',
              label: 'Meetings',
              description: 'Calls about it, with their summaries and actions.',
              icon: <MeetingsIcon />,
              onSelect: () => {
                workbench.track('UI', 'Opened', 'Meetings');
                setMeetings(true);
              },
            },
          ]
        : [],
    [live],
  );
  usePublishToolsItems('item-meetings', rows);

  if (!live) return null;
  return (
    <>
      {meetings ? (
        <Suspense fallback={null}>
          <MeetingsDialog onClose={() => setMeetings(false)} />
        </Suspense>
      ) : null}
      {chooser.open && signedIn ? (
        <Suspense fallback={null}>
          <StartCallPopover anchor={chooser.anchor} />
        </Suspense>
      ) : null}
    </>
  );
}
