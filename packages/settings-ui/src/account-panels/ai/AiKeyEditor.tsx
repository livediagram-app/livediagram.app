'use client';

import { useId, useState } from 'react';
import { Button, SegmentedToggle, Select } from '@liveworkspace/ui';
import { BUTTON, ErrorNote, INPUT } from '../account-ui';
import { ConfirmAction } from '../ConfirmAction';
import { accountErrorMessage, formatAccountDate } from '../errors';
import { useAccountPanelsHost } from '../host';
import {
  aiKeyPath,
  modelLabel,
  providerLabel,
  type AiKeyState,
  type AiKeysAnswer,
  type AiProviderChoice,
  type AiProviderId,
} from './ai-keys';

type Source = 'built-in' | 'key';

const SOURCE_OPTIONS = [
  {
    value: 'built-in',
    label: 'Built-In AI',
    description: 'Included with every app, with daily limits. No key needed.',
  },
  {
    value: 'key',
    label: 'Your Own Key',
    description: 'Your Anthropic or OpenAI key, billed by the provider, with no daily limits.',
  },
] as const;

// One owner's key in Settings › AI (ai-keys.md "Settings"): the person's own, or a team's for its admins. Built-In AI
// or Your Own Key; a key set shows its provider, model and last four characters, never more, and can be replaced,
// moved to another model or removed. The key field is write-only: what is typed goes out once and is cleared.
export function AiKeyEditor({
  teamId,
  state,
  providers,
  owner,
  onChanged,
}: {
  teamId: string | null;
  state: AiKeyState | null;
  providers: readonly AiProviderChoice[];
  // Whose key it is, in the provider's bill line: "you" or the team's name.
  owner: string;
  onChanged: (answer: AiKeysAnswer) => void;
}) {
  const { request } = useAccountPanelsHost();
  const [picked, setPicked] = useState<Source | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const source: Source = picked ?? (state ? 'key' : 'built-in');
  const path = aiKeyPath(teamId);

  const send = async (method: 'PUT' | 'PATCH' | 'DELETE', body?: unknown) => {
    setError(null);
    const result = await request<AiKeysAnswer>(path, method, body);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    onChanged(result.data);
    return true;
  };

  if (state && !replacing) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 dark:text-white" data-ai-key-provider="">
              {providerLabel(providers, state.provider)}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400" data-ai-key-state="">
              {state.hint ? `Key ending ${state.hint}` : 'Key set'} · Added{' '}
              {formatAccountDate(state.setAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={BUTTON.secondary} onClick={() => setReplacing(true)}>
              Replace Key
            </button>
            <ConfirmAction
              label="Remove"
              confirmLabel="Remove now"
              onConfirm={async () => {
                if (await send('DELETE')) setPicked(null);
              }}
            />
          </div>
        </div>
        <ModelPicker
          provider={providers.find((p) => p.id === state.provider)}
          value={state.model}
          label={modelLabel(providers, state)}
          onChoose={(model) => void send('PATCH', { model })}
        />
        {error && <ErrorNote>{accountErrorMessage(error)}</ErrorNote>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!replacing && (
        <SegmentedToggle
          label="Which AI"
          className="w-fit max-w-full"
          value={source}
          options={SOURCE_OPTIONS}
          onChange={(next) => {
            setError(null);
            setPicked(next);
          }}
        />
      )}
      {source === 'built-in' && !replacing ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {teamId === null
            ? 'Every app’s AI features run on built-in AI for you, with its daily limits.'
            : 'The team’s work runs on built-in AI, or on each member’s own key, until a team key is added.'}
        </p>
      ) : (
        <KeyForm
          providers={providers}
          initial={state}
          owner={owner}
          onCancel={replacing ? () => setReplacing(false) : null}
          onSave={async (body) => {
            if (await send('PUT', body)) {
              setReplacing(false);
              setPicked(null);
              return true;
            }
            return false;
          }}
        />
      )}
      {error && <ErrorNote>{accountErrorMessage(error)}</ErrorNote>}
    </div>
  );
}

function ModelPicker({
  provider,
  value,
  label,
  onChoose,
}: {
  provider: AiProviderChoice | undefined;
  value: string;
  label: string;
  onChoose: (model: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-300">
        Model
      </label>
      {provider ? (
        <Select
          id={id}
          value={value}
          className="self-start"
          selectClassName="min-w-[14rem]"
          onChange={(event) => {
            if (event.target.value !== value) onChoose(event.target.value);
          }}
        >
          {provider.models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          ))}
        </Select>
      ) : (
        <p id={id} className="text-sm text-slate-900 dark:text-slate-100">
          {label}
        </p>
      )}
    </div>
  );
}

function KeyForm({
  providers,
  initial,
  owner,
  onCancel,
  onSave,
}: {
  providers: readonly AiProviderChoice[];
  initial: AiKeyState | null;
  owner: string;
  onCancel: (() => void) | null;
  onSave: (body: { provider: AiProviderId; model: string; key: string }) => Promise<boolean>;
}) {
  const [providerId, setProviderId] = useState<AiProviderId>(
    initial?.provider ?? providers[0]?.id ?? 'anthropic',
  );
  const provider = providers.find((p) => p.id === providerId);
  const [model, setModel] = useState(
    initial?.provider === providerId ? initial.model : (provider?.defaultModel ?? ''),
  );
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const keyId = useId();

  async function submit() {
    if (busy || !key.trim()) return;
    setBusy(true);
    await onSave({ provider: providerId, model, key });
    // Cleared either way: a refused key is typed again, never kept in the page.
    setKey('');
    setBusy(false);
  }

  return (
    // No <form> and no password field: a browser offers to save, and sync, what a password field in a form sends,
    // whatever autocomplete says. The key is masked text, sent by the button or Enter.
    <div className="space-y-4" role="group" aria-label={`${provider?.label ?? 'API'} key`}>
      <SegmentedToggle
        label="Provider"
        className="w-fit max-w-full"
        value={providerId}
        options={providers.map((p) => ({
          value: p.id,
          label: p.label,
          description: `Use a key from ${p.label}. Its keys start “${p.keyPrefix}”.`,
        }))}
        onChange={(next) => {
          setProviderId(next);
          setModel(providers.find((p) => p.id === next)?.defaultModel ?? '');
          setKey('');
        }}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor={keyId} className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {provider?.label ?? 'API'} Key
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={keyId}
            // Write-only: masked text, never filled in, offered or saved by the browser, cleared once sent.
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            data-1p-ignore=""
            data-lpignore="true"
            className={`${INPUT} [-webkit-text-security:disc]`}
            placeholder={provider ? `${provider.keyPrefix}…` : ''}
            maxLength={512}
            value={key}
            onChange={(event) => setKey(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submit();
            }}
          />
          <Button
            type="button"
            onClick={() => void submit()}
            variant="none"
            className={`${BUTTON.primary} shrink-0`}
            busy={busy}
            disabled={!key.trim()}
          >
            {initial ? 'Replace Key' : 'Save Key'}
          </Button>
          {onCancel && (
            <button type="button" className={`${BUTTON.secondary} shrink-0`} onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Checked with {provider?.label ?? 'the provider'} before it’s saved, then kept encrypted.
          Nobody can see it again, you included. {provider?.label ?? 'The provider'} bills {owner}{' '}
          for what it answers.
        </p>
      </div>
      <ModelPicker provider={provider} value={model} label={model} onChoose={setModel} />
    </div>
  );
}
