'use client';

import { SaveSwitch, showsSaveSwitch } from '@livehuddle/ui';
import { kindWords } from '@liveworkspace/explorer';
import { useOptionalEditorContext } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { useToast } from '@/hooks/ui/useToast';
import { ConversionInProgressError, syncFailureMessage } from '@/lib/offline/offline-convert';
import type { StartPalette } from './start-palette';

const KIND = kindWords('livehuddle').one;

// The start screen's Sync Canvas to Server switch (docs/specs/006-document/save-locations.md "On the start screen"):
// the shared row (@liveworkspace/ui SaveSwitch) fed this editor's view of the open document and its two in-place
// moves. Reads only state the editor already holds, so it costs no request; it loads with the start's own chunk.
// Outside an editor (a start rendered on its own) it is not there.
export function StartSaveSwitch({ palette }: { palette: StartPalette }) {
  const ctx = useOptionalEditorContext();
  const toast = useToast();
  const onServer = !useIsOfflineDocument(ctx?.documentId ?? null);
  if (!ctx) return null;
  const selfId = ctx.selfParticipant.id;
  const shown = showsSaveSwitch({
    ready: ctx.hydrated && ctx.authLoaded && selfId !== 'self',
    isOwner: ctx.isOwner,
    canEdit: !ctx.isReadOnly,
    embedded: ctx.embedMode || ctx.workbenchMode,
    tabCount: ctx.tabs.length,
    empty: ctx.activeTab.elements.length === 0,
    shared: ctx.documentShareable || !!ctx.documentTeamId || !!ctx.sessionShareCode,
    othersPresent: ctx.livePresence.some((p) => p.id !== selfId),
  });
  return (
    <SaveSwitch
      shown={shown}
      kind={KIND}
      signedIn={!!ctx.accountUserId}
      onServer={onServer}
      toServer={ctx.syncToCloud}
      toBrowser={ctx.takeOfflineInPlace}
      onFailure={(move, e) => {
        // A conversion already running reports for itself.
        if (e instanceof ConversionInProgressError) return;
        toast.error(
          move === 'server'
            ? syncFailureMessage(e)
            : 'Couldn’t move this to this browser. It stays safe on the server.',
        );
      }}
      ink={{
        text: palette.text,
        muted: palette.muted,
        accent: palette.focus,
        surface: palette.column,
      }}
    />
  );
}
