'use client';

// An Embed File in a Dashboard slot (docs/specs/013-workspace/embeds.md "Embed File on a Dashboard", Work Tracker
// 1375): the platform's live embed face (LiveEmbedView) filling the slot, each reader with their own access, its Use
// the file and Open inside the slot's bottom right. An Editor chooses the file in Embed File, opened at once when this
// person placed the slot, by Choose a File on an empty one, by Slot Settings' Change File or by a double-click; the
// dialog loads only then.
import dynamic from 'next/dynamic';
import { useState, useSyncExternalStore } from 'react';
import { dashboardEmbedOf, type DashboardEmbedContent } from '@liveplanner/project';
import { Button } from '@liveworkspace/ui';
import { LiveEmbedView } from '@liveworkspace/workbench/components/live-embed/LiveEmbedView';
import { forgetEmbedAsk, isEmbedAsked, subscribeEmbedAsk } from '@/lib/embed-open-store';
import { track } from '@/lib/telemetry';
import { useDashboard } from './dashboard-context';

const DashboardEmbedPicker = dynamic(
  () => import('./DashboardEmbedPicker').then((m) => m.DashboardEmbedPicker),
  { ssr: false },
);

export function DashboardEmbedCard({
  slotId,
  embed,
}: {
  slotId: string;
  embed: DashboardEmbedContent;
}) {
  const { canEdit, actions } = useDashboard();
  const [opened, setOpened] = useState(false);
  // Asked open from outside the card: placed here a moment ago, or Change File in Slot Settings.
  const asked = useSyncExternalStore(
    subscribeEmbedAsk,
    () => isEmbedAsked(slotId),
    () => false,
  );
  const choosing = canEdit && (opened || asked);
  const setChoosing = (open: boolean) => {
    setOpened(open);
    if (!open) forgetEmbedAsk(slotId);
  };
  const empty = !embed.liveItem && !embed.livePoster;
  return (
    <div
      data-dashboard-embed=""
      className="absolute inset-0 rounded-[inherit]"
      onDoubleClick={canEdit ? () => setChoosing(true) : undefined}
    >
      <LiveEmbedView
        liveItem={embed.liveItem}
        liveName={embed.liveName}
        livePoster={embed.livePoster}
        hostName="liveplanner"
        canChoose={canEdit}
        controlsAt="inside"
      />
      {empty && canEdit ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <Button
            variant="primary"
            size="sm"
            className="pointer-events-auto"
            onClick={() => setChoosing(true)}
          >
            Choose a File
          </Button>
        </div>
      ) : null}
      {choosing ? (
        <DashboardEmbedPicker
          onChoose={(choice) => {
            actions.setSlotContent(slotId, dashboardEmbedOf(choice));
            track('Element', 'Added', 'LiveEmbed');
          }}
          onClose={() => setChoosing(false)}
        />
      ) : null}
    </div>
  );
}
