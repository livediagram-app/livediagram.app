'use client';

// AI Settings (docs/specs/030-knowledgebase/search-and-ask.md "AI Settings", "Built-in AI", "Providers"): which AI
// this knowledgebase runs on, built-in AI (the default, no key) or the team's own key, and for a key its provider,
// the key and the model. A dialog of the knowledgebase, opened from Ask and from Insights, not a row of the
// Settings panel: Settings holds a person's own preferences on this device and account, and the key is the
// knowledgebase's, the same for everyone who opens it. An Editor chooses the provider, adds, replaces or removes the
// key and chooses the model; everyone else sees how things stand, with no controls. Choosing Built-In AI with a key
// saved removes the key, asked first; choosing Your Own Key keeps built-in AI in use until a key is saved.
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
import { useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { closeAiSettings, useAiSettingsOpen } from '@/lib/knowledge-ask/ai-settings-open';
import { aiSettingsStore } from '@/lib/knowledge-ask/ai-settings-store';
import {
  BUILT_IN_NOTE,
  KEY_ENCRYPTED_NOTE,
  aiInUseTitle,
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
import { AiProviderPicker, AiSourcePicker, type AiSource } from './AiProviderPicker';
import { KeyIcon } from './ask-icons';
import { useAiSettingsState, useAskSession, type AskSession } from './useAskSession';

const SECTION_TITLE = 'text-[13px] font-semibold text-slate-900 dark:text-slate-100';
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
  const chrome = useEditorChromeStore();
  const titleId = useId();
  const [busy, setBusy] = useState<AiSettingsAction | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  // The provider the Editor picked here, until a key for it is saved: the stored provider changes only with a key.
  const [picked, setPicked] = useState<KnowledgeAiProvider | null>(null);
  // The other provider, asked for while a key is saved: the question before the key is replaced.
  const [confirmingProvider, setConfirmingProvider] = useState<KnowledgeAiProvider | null>(null);
  // Which AI the Editor picked here, until it takes: Your Own Key with a key saved, Built-In AI with the key removed.
  const [pickedSource, setPickedSource] = useState<AiSource | null>(null);
  const [confirmingBuiltIn, setConfirmingBuiltIn] = useState(false);

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
  // With a key saved the key is in use; with none, built-in AI (or, on a server without it, a key is the only way).
  const inUse: AiSource = settings?.hasKey || settings?.builtIn === false ? 'own-key' : 'built-in';
  const source = pickedSource ?? inUse;
  const chooseSource = (next: AiSource) => {
    if (next === source) return;
    setFailure(null);
    if (next === 'built-in' && settings?.hasKey) setConfirmingBuiltIn(true);
    else setPickedSource(next === inUse ? null : next);
  };

  const saveKey = (key: string) => {
    track('UI', 'Added', 'AiKey');
    void run('save-key', async () => {
      const saved = await apiSetKnowledgeAiKey(who, documentId, provider, key);
      setPicked(null);
      setPickedSource(null);
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
    setConfirmingBuiltIn(false);
    track('UI', 'Removed', 'AiKey');
    void run('remove-key', async () => {
      const removed = await apiRemoveKnowledgeAiKey(who, documentId);
      setPicked(null);
      setPickedSource(null);
      return removed;
    });
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
          subtitle="Ask, Insights and Describe to Set Up run on built-in AI, or on your team's own key."
        >
          <DialogCloseButton onClick={onClose} />
        </DialogHeader>
        <div className="flex flex-col gap-6 px-6 py-5" data-ai-settings="">
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

          <section aria-labelledby={`${titleId}-source`} className="flex flex-col gap-2.5">
            <h3 id={`${titleId}-source`} className={SECTION_TITLE}>
              Which AI
            </h3>
            {settings && rights.manageAi ? (
              <AiSourcePicker
                chosen={source}
                builtIn={settings.builtIn}
                disabled={busy !== null}
                labelledBy={`${titleId}-source`}
                onChoose={chooseSource}
              />
            ) : (
              <p
                className="min-h-12 text-sm text-slate-900 dark:text-slate-100"
                data-ai-source-name=""
              >
                {settings ? (inUse === 'built-in' ? 'Built-In AI' : 'Your Own Key') : ''}
              </p>
            )}
            {settings && source === 'built-in' ? (
              <p className={NOTE} data-ai-built-in-note="">
                {BUILT_IN_NOTE}
              </p>
            ) : null}
          </section>

          {settings && source === 'own-key' ? (
            // The key's three settings in one card, a hairline between each (owner 2026-11-22).
            <div className="flex flex-col divide-y divide-slate-200/80 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
              <section
                aria-labelledby={`${titleId}-provider`}
                className="flex flex-col gap-2.5 p-4"
              >
                <h3 id={`${titleId}-provider`} className={SECTION_TITLE}>
                  Provider
                </h3>
                {rights.manageAi ? (
                  <AiProviderPicker
                    providers={settings.providers}
                    chosen={provider}
                    disabled={busy !== null}
                    labelledBy={`${titleId}-provider`}
                    onChoose={chooseProvider}
                  />
                ) : (
                  <p
                    className="text-sm text-slate-900 dark:text-slate-100"
                    data-ai-provider-name=""
                  >
                    {providerWords(stored).name}
                  </p>
                )}
              </section>

              <section aria-labelledby={`${titleId}-key`} className="flex flex-col gap-2.5 p-4">
                <div className="flex min-h-7 items-center justify-between gap-3">
                  <h3 id={`${titleId}-key`} className={SECTION_TITLE}>
                    {`${providerWords(provider).spoken} API Key`}
                  </h3>
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      role="status"
                      data-ai-key-state=""
                      className={`inline-flex min-w-0 items-center gap-1.5 truncate rounded-full px-2 py-0.5 text-xs font-medium ${
                        settings.hasKey && !switching
                          ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <span aria-hidden className="flex shrink-0">
                        <KeyIcon />
                      </span>
                      <span className="truncate">
                        {settings
                          ? replacing
                            ? `${providerWords(stored).spoken} ${keyStateText(settings)}, in Use Until This One Is Saved`
                            : switching
                              ? 'No Key Yet'
                              : keyStateText(settings)
                          : state.status === 'failed'
                            ? 'Not Known'
                            : ''}
                      </span>
                    </span>
                    {settings.hasKey && rights.manageAi ? (
                      <Button
                        variant="ghost"
                        size="xs"
                        disabled={busy !== null}
                        onClick={() => setConfirmingRemove(true)}
                        className="text-rose-700 dark:text-rose-300"
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
                {rights.manageAi ? (
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
                  {KEY_ENCRYPTED_NOTE} {teamPaysNote(provider)}
                </p>
              </section>

              <section aria-labelledby={`${titleId}-model`} className="flex flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <h3 id={`${titleId}-model`} className={SECTION_TITLE}>
                    Model
                  </h3>
                  {switching ? null : rights.manageAi ? (
                    <Select
                      aria-labelledby={`${titleId}-model`}
                      value={settings.model}
                      disabled={busy !== null}
                      selectClassName="min-w-[13rem]"
                      onChange={(event) => setModel(event.target.value)}
                    >
                      {settings.models.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {modelLabel}
                    </p>
                  )}
                </div>
                <p className={NOTE} {...(switching ? { 'data-ai-model-pending': '' } : {})}>
                  {switching
                    ? `${providerWords(provider).spoken}'s most capable model, until you choose another once the key is saved.`
                    : 'The model that writes each answer. A larger model costs more.'}
                </p>
              </section>
            </div>
          ) : null}

          {failure ? (
            <Callout tone="error" size="md" role="alert">
              {failure}
            </Callout>
          ) : null}
          {!rights.manageAi ? (
            <p className={NOTE} data-ai-settings-read-only="">
              {rights.askOff === 'offline'
                ? 'A knowledgebase kept Offline has no Ask: there is no server to ask.'
                : 'Only an Editor of this knowledgebase can change these.'}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          {/* Which key answers you here (search-and-ask.md "Which key answers"), and the way to your own keys. */}
          <div className="mr-auto flex min-w-0 items-center gap-2">
            {settings ? (
              <span
                data-ai-in-use=""
                className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                <span
                  aria-hidden
                  className={`size-2 shrink-0 rounded-full ${aiInUseTitle(settings) ? 'bg-brand-500' : 'bg-slate-300'}`}
                />
                {aiInUseTitle(settings) ?? 'No AI Here Yet'}
              </span>
            ) : null}
            <Button
              variant="ghost"
              size="xs"
              data-ai-your-keys=""
              onClick={() => {
                track('UI', 'Opened', 'AiKeysSettings');
                onClose();
                chrome.get().openSettingsOn('ai');
              }}
            >
              Your AI Keys
            </Button>
          </div>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </Dialog>
      <ConfirmDialog
        open={confirmingRemove}
        title="Remove the Key?"
        message={
          settings?.builtIn
            ? 'Ask and everything else that uses a model go back to built-in AI, with its daily limits.'
            : 'Ask stops answering for everyone in this knowledgebase until an Editor adds a key again. Search and everything else keep working.'
        }
        confirmLabel="Remove"
        onConfirm={removeKey}
        onCancel={() => setConfirmingRemove(false)}
      />
      <ConfirmDialog
        open={confirmingBuiltIn}
        title="Use Built-In AI Instead?"
        message={`The team's ${providerWords(stored).spoken} key is removed, and Ask, conflict checks, drafted pages and Describe to Set Up run on built-in AI, with its daily limits.`}
        confirmLabel="Use Built-In AI"
        onConfirm={removeKey}
        onCancel={() => setConfirmingBuiltIn(false)}
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
