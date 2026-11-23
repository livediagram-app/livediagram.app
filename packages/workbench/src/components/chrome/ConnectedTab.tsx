'use client';

// A connected tab in the footer (liveworkspace/docs/specs/004-index/connected-tabs.md "How it looks"): a TabFrame like
// its neighbours, led by the target app's logo. Another app's carries a small arrow (it opens in a new browser tab);
// one that opens nothing carries an amber dot instead. Its name follows the target's (IDX26) unless the app lets an
// Editor rename it ("A tab's own name"): then its rename field and double-click pass through, and a renamed tab's
// tooltip names the file. A press selects it like any tab and never opens the file (its page's Open does).
// Everything else (the menu, avatars, dragging, folders) passes through.
import type { App, TabConnection } from '@liveworkspace/index-client';
import { BrandMark } from '@liveworkspace/brand';
import { lucideArrowUpRight } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveworkspace/ui';
import { TabFrame, type TabFrameProps } from './TabFrame';
import { connectedTabPhrase, connectedToLine } from '../connect/connect-words';
import { useConnectedTabBroken } from '../connect/connected-tab-store';

const ArrowGlyph = lucideGlyph(lucideArrowUpRight, 11);

export type ConnectedTabProps = Omit<
  TabFrameProps,
  'lead' | 'lockIcon' | 'afterName' | 'tooltip'
> & {
  connection: TabConnection;
  // The app this tab bar belongs to: a target in the same app opens in place, so it carries no arrow.
  hostApp: App;
  // The last open said it opens nothing (gone, its link removed, a copy's): the amber dot. Absent, the page's last
  // open says (connected-tab-store).
  broken?: boolean;
  // The target's own name, given only while the tab has a name of its own: its tooltip and screen reader name it.
  targetName?: string | undefined;
};

export function ConnectedTab({
  connection,
  hostApp,
  broken: brokenProp,
  targetName,
  ...frame
}: ConnectedTabProps) {
  const sameApp = connection.app === hostApp;
  const brokenSeen = useConnectedTabBroken(connection.id);
  const broken = brokenProp ?? brokenSeen;
  return (
    <TabFrame
      // A press only selects the tab: its page shows the file's preview, and Open there opens the file.
      {...frame}
      {...(targetName ? { tooltip: connectedToLine(targetName) } : {})}
      lead={<BrandMark app={connection.app} className="size-3.5" />}
      afterName={
        <>
          {broken ? (
            <span
              aria-hidden
              data-connected-broken=""
              className="size-1.5 shrink-0 rounded-full bg-amber-500 dark:bg-amber-400"
            />
          ) : sameApp ? null : (
            <span aria-hidden data-connected-away="" className="flex shrink-0 opacity-60">
              <ArrowGlyph />
            </span>
          )}
          <span className="sr-only">{connectedTabPhrase(connection.app, broken, targetName)}</span>
        </>
      }
    />
  );
}
