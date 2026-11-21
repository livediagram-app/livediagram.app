'use client';

// AI Settings (docs/specs/030-knowledgebase/search-and-ask.md "Ask", "Providers"): the provider this knowledgebase
// runs on, the team's own key for it and the model. A dialog of the knowledgebase, opened from Ask and from AI Knowledge, not a row of the
// Settings panel: Settings holds a person's own preferences on this device and account, and the key is the
// knowledgebase's, the same for everyone who opens it. An Editor chooses the provider, adds, replaces or removes the
// key and chooses the model; everyone else sees how things stand, with no controls.
import { useEffect, useId, useRef, useState } from 'react';
import type { KnowledgeAiProvider, KnowledgeAiSettings } from '@liveknowledge/api-schema';
import { Button, DialogCloseButton, DialogFooter, DialogHeader, Select } from '@liveknowledge/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { ConfirmDialog } from '@liveworkspace/workbench/components/dialogs/ConfirmDialog';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import {
  apiRemoveKnowledgeAiKey,
  apiSetKnowledgeAiKey,
  apiSetKnowledgeAiModel,
} from '@/lib/api/knowledge';
import { closeAiSettings, useAiSettingsOpen } from '@/lib/knowledge-ask/ai-settings-open';
import { aiSettingsStore } from '@/lib/knowledge-ask/ai-settings-store';
import {
  KEY_ENCRYPTED_NOTE,
  TEAM_PAYS_ANY_NOTE,
  aiSettingsFailureText,
  keyStateText,
  teamPaysNote,
  type AiSettingsAction,
} from '@/lib/knowledge-ask/ai-settings-words';
import {
  providerWords,
  replaceProviderMessage,
  replaceProviderTitle,
} from '@/lib/knowledge-ask/provider-words';
import { track } from '@/lib/telemetry';
import { AiKeyForm } from './AiKeyForm';
import { AiProviderPicker } from './AiProviderPicker';
import { KeyIcon } from './ask-icons';
import { useAiSettingsState, useAskSession, type AskSession } from './useAskSession';

const SECTION_TITLE = 'text-sm font-semibold text-slate-900 dark:text-slate-100';
const NOTE = 'text-xs leading-relaxed text-slate-600 dark:text-slate-400';

/** The dialog, drawn by the views' host: nothing until opened. */
export function AiSettingsHost() {
  const open = useAiSettingsOpen();
  const session = useAskSession();
  // Another knowledgebase, or the host going, closes it. Not a cleanup that closes outright: React's development
  // StrictMode runs every cleanup once right after mounting, which closed the dialog the moment it opened, from every
  // door (sweep 2026-11-21). A real unmount is told apart by the remount not following.
  const documentId = session?.documentId;
  const shown = useRef<string | undefined>(undefined);
  const mounted = useRef(false);
  useEffect(() => {
    if (shown.current !== undefined && shown.current !== documentId) closeAiSettings();
    shown.current = documentId;
  }, [documentId]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (!mounted.current) closeAiSettings();
      });
    };
  }, []);
  if (!open || !session) return null;
  return <AiSettingsDialog session={session} onClose={closeAiSettings} />;
}

export function AiSettingsDialog({
  session,
  onClose,
}: {
  session: AskSession;
  onClose: () => void;
}) {
  const { documentId, who, rights } = session;
  const state = useAiSettingsState(documentId);
  const titleId = useId();
  const [busy, setBusy] = useState<AiSettingsAction | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  // The provider the Editor picked here, until a key for it is saved: the stored provider changes only with a key.
  const [picked, setPicked] = useState<KnowledgeAiProvider | null>(null);
  // The other provider, asked for while a key is saved: the question before the key is replaced.
  const [confirmingProvider, setConfirmingProvider] = useState<KnowledgeAiProvider | null>(null);

  useEffect(() => {
    void aiSettingsStore.load(who, documentId);
  }, [who, documentId]);

  // One write at a time; its answer is the settings as they are now. The request and its failure never hold the
  // key: `aiSettingsFailureText` reads a code and a status.
  const run = async (action: AiSettingsAction, write: () => Promise<KnowledgeAiSettings>) => {
    if (busy) return;
    setBusy(action);
    setFailure(null);
    try {
      aiSettingsStore.set(documentId, await write());
    } catch (err) {
      setFailure(aiSettingsFailureText(err, action, provider));
    } finally {
      setBusy(null);
    }
  };

  const settings = state.status === 'ready' ? state.settings : null;
  const stored: KnowledgeAiProvider = settings?.provider ?? 'anthropic';
  const provider = picked ?? stored;
  // A provider picked but not yet saved: the stored key stays in use until a key for the new one is saved.
  const switching = settings !== null && provider !== stored;
  const replacing = switching && settings.hasKey;

  const saveKey = (key: string) => {
    track('UI', 'Added', 'AiKey');
    void run('save-key', async () => {
      const saved = await apiSetKnowledgeAiKey(who, documentId, provider, key);
      setPicked(null);
      return saved;
    });
  };
  const chooseProvider = (next: KnowledgeAiProvider) => {
    if (next === provider) return;
    setFailure(null);
    // Back to the stored provider is no change; away from one with a key saved is asked first.
    if (next === stored) setPicked(null);
    else if (settings?.hasKey) setConfirmingProvider(next);
    else setPicked(next);
  };
  const confirmProvider = () => {
    track('UI', 'Changed', 'AiProvider');
    setPicked(confirmingProvider);
    setConfirmingProvider(null);
  };
  const removeKey = () => {
    setConfirmingRemove(false);
    track('UI', 'Removed', 'AiKey');
    void run('remove-key', () => apiRemoveKnowledgeAiKey(who, documentId));
  };
  const setModel = (model: string) => {
    track('UI', 'Changed', 'AiModel');
    void run('set-model', () => apiSetKnowledgeAiModel(who, documentId, model));
  };

  const modelLabel =
    settings?.models.find((m) => m.id === settings.model)?.label ?? settings?.model ?? '';

  return (
    <>
      <Dialog open onClose={onClose} titleId={titleId} size="md" phoneSheet>
        <DialogHeader
          title={<span id={titleId}>AI Settings</span>}
          subtitle="Ask, AI Knowledge and Describe to Set Up run on your team's own AI key."
        >
          <DialogCloseButton onClick={onClose} />
        </DialogHeader>
        {/* One height whatever is showing (loading, a key or none, an Editor or not), so nothing jumps when the
            settings arrive or a key is saved. */}
        <div className="flex min-h-[23rem] flex-col gap-5 px-6 py-5" data-ai-settings="">
          {state.status === 'failed' ? (
            <Callout
              tone="error"
              size="md"
              role="alert"
              action={{
                label: 'Try Again',
                onSelect: () => void aiSettingsStore.load(who, documentId),
              }}
            >
              The AI settings could not be read. Check your connection.
            </Callout>
          ) : null}

          <section aria-labelledby={`${titleId}-provider`} className="flex flex-col gap-2">
            <h3 id={`${titleId}-provider`} className={SECTION_TITLE}>
              Provider
            </h3>
            {settings && rights.manageAi ? (
              <AiProviderPicker
                providers={settings.providers}
                chosen={provider}
                disabled={busy !== null}
                labelledBy={`${titleId}-provider`}
                onChoose={chooseProvider}
              />
            ) : (
              <p
                className="min-h-12 text-sm text-slate-900 dark:text-slate-100"
                data-ai-provider-name=""
              >
                {settings ? providerWords(stored).name : ''}
              </p>
            )}
          </section>

          <section aria-labelledby={`${titleId}-key`} className="flex flex-col gap-3">
            <h3 id={`${titleId}-key`} className={SECTION_TITLE}>
              {settings ? `${providerWords(provider).spoken} API Key` : 'API Key'}
            </h3>
            <div className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
              <span
                aria-hidden
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                  settings?.hasKey
                    ? 'bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-200'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                <KeyIcon />
              </span>
              <p
                role="status"
                data-ai-key-state=""
                className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                {settings
                  ? replacing
                    ? `${providerWords(stored).spoken} ${keyStateText(settings)}, in Use Until This One Is Saved`
                    : switching
                      ? 'No Key Yet'
                      : keyStateText(settings)
                  : state.status === 'failed'
                    ? 'Not Known'
                    : ''}
              </p>
              {settings?.hasKey && rights.manageAi ? (
                <Button
                  variant="secondary"
                  size="xs"
                  disabled={busy !== null}
                  onClick={() => setConfirmingRemove(true)}
                >
                  Remove
                </Button>
              ) : null}
            </div>
            {rights.manageAi && settings ? (
              <AiKeyForm
                // A field of its own for each provider: nothing typed for one is ever sent as the other's.
                key={provider}
                provider={provider}
                hasKey={settings.hasKey && !switching}
                busy={busy === 'save-key'}
                onSave={saveKey}
              />
            ) : null}
            <p className={NOTE}>
              {KEY_ENCRYPTED_NOTE} {settings ? teamPaysNote(provider) : TEAM_PAYS_ANY_NOTE}
            </p>
          </section>

          <section aria-labelledby={`${titleId}-model`} className="flex flex-col gap-2">
            <h3 id={`${titleId}-model`} className={SECTION_TITLE}>
              Model
            </h3>
            {switching ? (
              <p
                className="min-h-[30px] text-sm text-slate-900 dark:text-slate-100"
                data-ai-model-pending=""
              >
                {providerWords(provider).spoken}&apos;s most capable model, until you choose another
                once the key is saved.
              </p>
            ) : settings && rights.manageAi ? (
              <Select
                aria-labelledby={`${titleId}-model`}
                value={settings.model}
                disabled={busy !== null}
                className="self-start"
                selectClassName="min-w-[14rem]"
                onChange={(event) => setModel(event.target.value)}
              >
                {settings.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </Select>
            ) : (
              <p className="min-h-[30px] text-sm text-slate-900 dark:text-slate-100">
                {modelLabel}
              </p>
            )}
            <p className={NOTE}>The model that writes each answer. A larger model costs more.</p>
          </section>

          {failure ? (
            <Callout tone="error" size="md" role="alert">
              {failure}
            </Callout>
          ) : null}
          {!rights.manageAi ? (
            <p className={`${NOTE} mt-auto`} data-ai-settings-read-only="">
              {rights.askOff === 'offline'
                ? 'A knowledgebase kept Offline has no Ask: there is no server to keep a key.'
                : 'Only an Editor of this knowledgebase can change these.'}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </Dialog>
      <ConfirmDialog
        open={confirmingRemove}
        title="Remove the Key?"
        message="Ask stops answering for everyone in this knowledgebase until an Editor adds a key again. Search and everything else keep working."
        confirmLabel="Remove"
        onConfirm={removeKey}
        onCancel={() => setConfirmingRemove(false)}
      />
      <ConfirmDialog
        open={confirmingProvider !== null}
        title={confirmingProvider ? replaceProviderTitle(stored, confirmingProvider) : ''}
        message={confirmingProvider ? replaceProviderMessage(stored, confirmingProvider) : ''}
        confirmLabel="Choose Provider"
        onConfirm={confirmProvider}
        onCancel={() => setConfirmingProvider(null)}
      />
    </>
  );
}
