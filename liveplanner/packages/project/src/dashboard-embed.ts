// An Embed File in a Dashboard slot (docs/specs/013-workspace/embeds.md "Embed File on a Dashboard", Work Tracker
// 1375): another app's file shown live and read-only, its link and snapshot kept on the slot's content as the canvas
// apps keep them on their Embed element (@liveworkspace/element-model live-item.ts). Empty until an Editor chooses.
import {
  isLiveItem,
  isLiveName,
  isLivePoster,
  type LiveItem,
} from '@liveworkspace/element-model/live-item';

export type DashboardEmbedContent = {
  type: 'embed';
  liveItem?: LiveItem;
  liveName?: string;
  livePoster?: string;
};

/** A stored Embed File, read safely: a field that fails its guard is dropped, never the slot. */
export function readDashboardEmbed(c: Record<string, unknown>): DashboardEmbedContent | undefined {
  if (c['type'] !== 'embed') return undefined;
  const item = c['liveItem'];
  return {
    type: 'embed',
    ...(isLiveItem(item) ? { liveItem: { app: item.app, itemId: item.itemId } } : {}),
    ...(isLiveName(c['liveName']) ? { liveName: c['liveName'] } : {}),
    ...(isLivePoster(c['livePoster']) ? { livePoster: c['livePoster'] } : {}),
  };
}

/** The slot's content once a file is chosen: its link and fresh snapshot, any earlier poster gone. */
export function dashboardEmbedOf(choice: {
  liveItem: LiveItem;
  liveName: string;
  livePoster?: string;
}): DashboardEmbedContent {
  return {
    type: 'embed',
    liveItem: choice.liveItem,
    liveName: choice.liveName,
    ...(choice.livePoster ? { livePoster: choice.livePoster } : {}),
  };
}
