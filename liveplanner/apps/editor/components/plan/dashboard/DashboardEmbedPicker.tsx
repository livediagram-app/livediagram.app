'use client';

// Embed File for a Dashboard slot (docs/specs/013-workspace/embeds.md "Embed File on a Dashboard", Work Tracker 1375):
// the shared dialog, with this plan's connected files first and, where Connect File could connect, the role and the
// embed's tab. Loaded only when the dialog opens, so the editor's context is read only while it shows.
import type { LiveEmbedChoice } from '@liveworkspace/workbench/components/live-embed/choose-live-embed';
import { LiveEmbedPicker } from '@liveworkspace/workbench/components/live-embed/LiveEmbedPicker';
import { liveEmbedConnectOf } from '@liveworkspace/workbench/components/live-embed/useEmbedFileOnPlace';
import { connectedTargets } from '@liveworkspace/workbench/components/connect/tab-connection';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { useOptionalEditorContext } from '@/app/project/[id]/EditorContext';
import { useConnectHost } from '@/components/connect/useConnectHost';

export function DashboardEmbedPicker({
  onChoose,
  onClose,
}: {
  onChoose: (choice: LiveEmbedChoice) => void;
  onClose: () => void;
}) {
  const ctx = useOptionalEditorContext();
  const connect = liveEmbedConnectOf(useConnectHost());
  // A plan kept only in this browser has no file in the index to stand beside: nothing to choose from.
  if (!ctx?.projectId) return null;
  return (
    <LiveEmbedPicker
      client={indexClient}
      hostId={ctx.projectId}
      connectedIds={[...connectedTargets(ctx.tabs).keys()]}
      connect={connect}
      onChoose={onChoose}
      onClose={onClose}
    />
  );
}
