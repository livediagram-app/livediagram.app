'use client';

// AI Editing (docs/specs/030-knowledgebase/ai-editing.md "The dialog"): how far agents may change pages themselves,
// chosen by an Editor from the knowledgebase's menu. A centred modal of one steady height (a sheet on a phone) under
// the shared hero header, three cards and, under Edit Any Page, Remove Verification When AI Edits. Nothing changes
// until Save, offered once something differs; a failed save says so here and keeps the choice.
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import type { AiEditing } from '@liveknowledge/knowledge';
import { Button, DialogFooter } from '@liveknowledge/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { useAskSession, type AskSession } from '@/components/ask/useAskSession';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { apiSetAiEditing } from '@/lib/api/knowledge';
import { closeAiEditing, useAiEditingOpen } from '@/lib/knowledge-settings/ai-editing-open';
import {
  knowledgeSettingsStore,
  type AiEditingChoice,
} from '@/lib/knowledge-settings/knowledge-settings-store';
import { track } from '@/lib/telemetry';
import { lucideInfo } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveknowledge/ui';
import { aiEditingHeroArt } from './ai-editing-art';
import { AiEditingChoices } from './AiEditingChoices';
import {
  AI_EDITING_SUBTITLE,
  AI_EDITING_TITLE,
  ALLOW_WRITING_NOTE,
  SAVE_FAILED,
  SAVE_REFUSED,
} from './ai-editing-words';

const InfoIcon = lucideGlyph(lucideInfo, 14);

/** The dialog, drawn once by the editor's dialogs: nothing until opened. Another knowledgebase closes it. */
export function AiEditingHost() {
  const open = useAiEditingOpen();
  const session = useAskSession();
  const documentId = session?.documentId;
  const shown = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (shown.current !== undefined && shown.current !== documentId) closeAiEditing();
    shown.current = documentId;
  }, [documentId]);
  if (!open || !session) return null;
  return <AiEditingDialog session={session} onClose={closeAiEditing} />;
}

function useHeldChoice(documentId: string): AiEditingChoice {
  return useSyncExternalStore(
    knowledgeSettingsStore.subscribe,
    () => knowledgeSettingsStore.aiEditingOf(documentId),
    () => knowledgeSettingsStore.aiEditingOf(documentId),
  );
}

const failureText = (err: unknown): string =>
  err instanceof ApiError && err.status === 403 ? SAVE_REFUSED : SAVE_FAILED;

export function AiEditingDialog({
  session,
  onClose,
  save = apiSetAiEditing,
}: {
  session: AskSession;
  onClose: () => void;
  /** The write, for a test to stand in for. */
  save?: typeof apiSetAiEditing;
}) {
  const { documentId, who } = session;
  const titleId = useId();
  const held = useHeldChoice(documentId);
  // The choice on screen: what is held until the Editor picks, then theirs until Save or Cancel.
  const [level, setLevel] = useState<AiEditing>(held.level);
  const [unverifies, setUnverifies] = useState(held.unverifies);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const changed = level !== held.level || unverifies !== held.unverifies;

  useEffect(() => {
    track('UI', 'Opened', 'AiEditing');
  }, []);

  const onSave = async () => {
    if (!changed || busy) return;
    setBusy(true);
    setFailure(null);
    // Each change said before it is stored, so an opt-out still reaches the wire.
    if (level !== held.level)
      track(
        'UI',
        'Changed',
        level === 'suggest'
          ? 'AiEditingSuggest'
          : level === 'unverified'
            ? 'AiEditingUnverified'
            : 'AiEditingAny',
      );
    if (unverifies !== held.unverifies)
      track('UI', 'Toggled', unverifies ? 'AiEditUnverifiesOn' : 'AiEditUnverifiesOff');
    try {
      const stored = await save(who, documentId, {
        ...(level !== held.level ? { aiEditing: level } : {}),
        ...(unverifies !== held.unverifies ? { aiEditUnverifies: unverifies } : {}),
      });
      knowledgeSettingsStore.take(documentId, stored);
      onClose();
    } catch (err) {
      setFailure(failureText(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      titleId={titleId}
      size="lg"
      phoneSheet
      // One height whatever is chosen (the switch unfolds inside it), never taller than the window.
      className="h-[min(42rem,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] max-sm:h-[min(44rem,85dvh)] max-sm:max-h-[85dvh]"
    >
      <HeroDialogHeader
        art={aiEditingHeroArt}
        titleId={titleId}
        title={AI_EDITING_TITLE}
        subtitle={AI_EDITING_SUBTITLE}
        actions={<HelpArticleLink article="aiEditing" size="md" />}
        onClose={onClose}
        underHandle
      />
      <div
        className="scrollbar-slim flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 sm:px-6"
        data-ai-editing=""
      >
        <AiEditingChoices
          level={level}
          unverifies={unverifies}
          disabled={busy}
          labelledBy={titleId}
          onLevel={(next) => {
            setFailure(null);
            setLevel(next);
          }}
          onUnverifies={(next) => {
            setFailure(null);
            setUnverifies(next);
          }}
        />
        <p
          className="flex items-start gap-2 px-1 text-xs leading-[18px] text-slate-600 dark:text-slate-400"
          data-ai-editing-note=""
        >
          <span aria-hidden className="mt-0.5 flex shrink-0">
            <InfoIcon />
          </span>
          {ALLOW_WRITING_NOTE}
        </p>
        {failure ? (
          <Callout tone="error" size="md" role="alert">
            {failure}
          </Callout>
        ) : null}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => void onSave()}
          disabled={!changed || busy}
          data-ai-editing-save=""
        >
          {busy ? 'Saving' : 'Save'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
