import { Tooltip } from '@/components/primitives/Tooltip';
import { TabPresenceStack } from '@/components/chrome/TabPresenceStack';
import { TabNotSharedIcon } from '@/components/chrome/tab-bar-icons';
import type { Participant } from '@/lib/identity';

// A tab outside a tab-scoped share session's scope (docs/specs/013-workspace/tab-scoped-share-links.md). It
// keeps its place in the bar so the visitor knows the diagram has more, but
// shows no name (the server never sent one) and does nothing when pressed:
// no switch, no menu, no drag. A dashed outline rather than a faded fill, so
// the label keeps its contrast. Peers on that tab still stack their avatars
// on it; an id is not content.
export function OutOfScopeTabPill({
  participants,
  selfId,
  selfRole,
}: {
  participants: Participant[];
  selfId: string;
  selfRole: 'edit' | 'view';
}) {
  return (
    <div
      draggable={false}
      className="flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2.5 text-slate-500 dark:border-slate-600 dark:text-slate-400"
    >
      <Tooltip title="Not shared" description="This tab isn't shared with you.">
        <button
          type="button"
          aria-disabled="true"
          className="flex cursor-not-allowed items-center gap-1.5 rounded-lg py-1 text-sm font-medium"
        >
          <TabNotSharedIcon />
          Not shared
        </button>
      </Tooltip>
      <TabPresenceStack participants={participants} selfId={selfId} selfRole={selfRole} />
    </div>
  );
}
