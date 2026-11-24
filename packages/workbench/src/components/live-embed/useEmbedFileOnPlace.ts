// Placing an Embed File opens its dialog at once (liveworkspace/docs/specs/004-index/live-embeds.md "Making one", Work
// Tracker 1375): an empty live embed that first appears after the editor opened, and is selected then (or by the very
// next change, when the editor selects it a render later), opens Embed File for it. Embeds the editor opened with, a
// collaborator's (never selected here), a chosen one, one seen before (undo, a tab switched back to) and one that is
// not selected never open it. A set of ids seen, grown as embeds appear, and the selected id read from the selection
// store: no timer.
import { useEffect, useRef } from 'react';
import type { ConnectionMade } from '@liveworkspace/index-client';
import { useSelectionOf } from '../../hooks/canvas/useSelectionStore';
import type { LiveEmbedConnect } from './LiveEmbedPicker';

type MaybeLiveEmbed = { id: string; type: string; embedProvider?: string; liveItem?: unknown };

const isLiveEmbed = (el: MaybeLiveEmbed): boolean =>
  el.type === 'video' && el.embedProvider === 'live';

/** What the hook remembers between renders: every live embed seen, and the empty ones that appeared last time, which
 *  may still be selected one change later. */
export type EmbedPlaceMemory = { seen: Set<string>; fresh: Set<string> };

/** The id of the embed to open Embed File for, or null: an empty live embed, selected, that appeared in this change or
 *  the one before. Records the change in `memory`. Pure but for `memory`, so it is tested alone. */
export function embedToOpen(
  elements: readonly MaybeLiveEmbed[],
  selectedId: string | null,
  memory: EmbedPlaceMemory,
): string | null {
  const fresh = new Set<string>();
  let open: string | null = null;
  for (const el of elements) {
    if (!isLiveEmbed(el)) continue;
    const empty = el.liveItem === undefined;
    const isNew = !memory.seen.has(el.id);
    if (isNew) memory.seen.add(el.id);
    if (!empty) continue;
    if (isNew || memory.fresh.has(el.id)) {
      if (el.id === selectedId) open = el.id;
      else if (isNew) fresh.add(el.id);
    }
  }
  memory.fresh = fresh;
  return open;
}

// The selected element's id alone, so a selection change re-renders only the caller (EmbedFileOnPlace), never more.
const selectedIdOf = (s: { selectedId: string | null }) => s.selectedId;

export function useEmbedFileOnPlace({
  elements,
  enabled,
  open,
}: {
  // The open tab's elements.
  elements: readonly MaybeLiveEmbed[];
  // An Editor who may choose (not read-only, the item on the server).
  enabled: boolean;
  open: (elementId: string) => void;
}): void {
  const selectedId = useSelectionOf(selectedIdOf);
  // Null until the first render has recorded what the editor opened with.
  const memory = useRef<EmbedPlaceMemory | null>(null);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  });
  useEffect(() => {
    if (memory.current === null) {
      memory.current = { seen: new Set(), fresh: new Set() };
      embedToOpen(elements, null, memory.current);
      memory.current.fresh = new Set();
      return;
    }
    const id = embedToOpen(elements, selectedId, memory.current);
    if (id && enabled) openRef.current(id);
  }, [elements, selectedId, enabled]);
}

/** The hook as a component of its own, rendering nothing: a host mounts it beside its dialogs, so only it re-renders
 *  as the selection changes. */
export function EmbedFileOnPlace(props: Parameters<typeof useEmbedFileOnPlace>[0]): null {
  useEmbedFileOnPlace(props);
  return null;
}

/** The editor's Connect host, as Embed File needs it: undefined where Connect File's entry would not show. */
export function liveEmbedConnectOf(
  host:
    | {
        hostKind: string;
        connected: ReadonlyMap<string, string>;
        grant: () => Promise<string | null>;
        newTabId: () => string;
        addConnectedTab: (made: ConnectionMade, tabId: string) => Promise<void>;
      }
    | undefined,
): LiveEmbedConnect | undefined {
  if (!host) return undefined;
  return {
    hostKind: host.hostKind,
    connected: host.connected,
    grant: host.grant,
    newTabId: host.newTabId,
    addTab: (made: ConnectionMade, tabId: string) => host.addConnectedTab(made, tabId),
  };
}
