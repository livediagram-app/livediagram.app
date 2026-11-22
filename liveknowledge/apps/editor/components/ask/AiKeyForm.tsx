'use client';

// The field the team's own key is typed into (docs/specs/030-knowledgebase/search-and-ask.md "Ask", "Providers"). The key
// lives in the input's own DOM value and nowhere else: never in React state, a store, a log or telemetry. It is read
// once when sent and the field is cleared in the same turn, whatever the answer, so it is never on screen or in
// memory here after the request leaves.
import { useId, useRef, useState, type FormEvent } from 'react';
import type { KnowledgeAiProvider } from '@liveknowledge/api-schema';
import { Button, TextInput } from '@liveknowledge/ui';
import { addKeyLabel, providerWords } from '@/lib/knowledge-ask/provider-words';

export function AiKeyForm({
  provider,
  hasKey,
  busy,
  onSave,
}: {
  /** Whose key is being typed: the label, the placeholder and where to make one follow it. */
  provider: KnowledgeAiProvider;
  /** A key of this provider is saved, so this one replaces it. */
  hasKey: boolean;
  busy: boolean;
  // Handed the key once. The form holds no copy after this call.
  onSave: (key: string) => void;
}) {
  const field = useRef<HTMLInputElement>(null);
  // Whether anything is typed, to enable the button: a yes or no, never the text.
  const [typed, setTyped] = useState(false);
  const fieldId = useId();
  const hintId = useId();
  const words = providerWords(provider);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const input = field.current;
    if (!input || busy) return;
    const key = input.value.trim();
    input.value = '';
    setTyped(false);
    if (key) onSave(key);
  };

  return (
    <form onSubmit={submit} autoComplete="off" className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-xs font-medium text-slate-700 dark:text-slate-200">
        {hasKey ? 'Replace the Key' : addKeyLabel(provider)}
      </label>
      <div className="flex gap-2">
        <TextInput
          ref={field}
          id={fieldId}
          type="password"
          // Not a sign-in: no browser or password manager should offer to fill or keep it.
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-1p-ignore=""
          data-lpignore="true"
          data-ai-key-field=""
          placeholder={words.keyPlaceholder}
          hintId={hintId}
          className="min-w-0 flex-1 font-mono"
          onInput={(event) => setTyped(event.currentTarget.value.trim() !== '')}
        />
        <Button type="submit" variant="primary" disabled={!typed || busy} busy={busy}>
          {hasKey ? 'Replace' : 'Save Key'}
        </Button>
      </div>
      <p id={hintId} className="text-xs text-slate-600 dark:text-slate-400">
        Make a key in {words.console} and paste it here.
      </p>
    </form>
  );
}
