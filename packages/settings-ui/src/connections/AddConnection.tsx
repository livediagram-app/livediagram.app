'use client';

import { useId, useRef, useState, type FormEvent, type RefObject } from 'react';
import {
  WEBHOOK_NAME_MAX,
  WEBHOOK_URL_MAX,
  type Webhook,
  type WebhookKind,
} from '@liveworkspace/index-client';
import { Button } from '@liveworkspace/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { webhooksHeroArt } from '@liveworkspace/ui/dialog-hero-art/webhooks';
import { BUTTON, ErrorNote, INPUT } from '../account-panels/account-ui';
import { ConnectPanel } from './ConnectPanel';
import { DestinationPicker, FormStep } from './pickers';
import { useDocumentWebhooks } from './host';
import { attempt, isAddressError, KINDS, webhookError } from './connections-api';

const LABEL = 'block text-sm font-medium text-slate-700 dark:text-slate-300';
// The address field refused: a rose edge and ring, as a field that needs fixing reads everywhere. Marked important so
// they beat INPUT's own focus edge (slate, white in dark), since a refusal moves the keyboard into this field.
const INVALID =
  'border-rose-400! focus:border-rose-500! focus:ring-rose-100! dark:border-rose-500/70! dark:focus:border-rose-400! dark:focus:ring-rose-500/20!';

// Adding a connection to the item (webhooks.md "Who adds one", "Managing them"), in the order a person thinks of it:
// where it posts, its address (with how to get one) and a name. What it sends is a rule's to say, never the form's.
export function AddConnection({
  titleId,
  firstRef,
  onAdded,
  onCancel,
}: {
  // The heading's id, which names the popover it opens in.
  titleId: string;
  // The chosen destination, which takes the keyboard as the form opens.
  firstRef: RefObject<HTMLInputElement | null>;
  onAdded: (webhook: Webhook, secret: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  const id = useId();
  const [kind, setKind] = useState<WebhookKind>('slack');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const { api } = useDocumentWebhooks();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  // A refusal of the address shows by its field; any other, above the buttons.
  const addressError = error !== null && isAddressError(error);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await attempt(() => api.create({ name: name.trim(), kind, url: url.trim() }));
    setBusy(false);
    if (result.ok) {
      await onAdded(result.data.webhook, result.data.secret);
      return;
    }
    setError(result.error);
    // The keyboard goes to what needs fixing: the address it refused (the reason read out with it), or it stays on
    // Add Connection for any other refusal, said just above it.
    if (isAddressError(result.error)) {
      const field = urlRef.current;
      field?.focus();
      field?.scrollIntoView?.({ block: 'center' });
    }
  }

  const words = KINDS[kind];
  const missing = !name.trim() ? 'a name' : !url.trim() ? 'an address' : null;
  return (
    <form
      onSubmit={(event) => void submit(event)}
      aria-labelledby={titleId}
      data-webhook-form=""
      className="flex flex-col"
    >
      {/* The popover's own header: the Connections dialog's art, its title and its close. */}
      <HeroDialogHeader
        art={webhooksHeroArt}
        titleId={titleId}
        title="Add a Connection"
        onClose={onCancel}
      />
      <div className="flex flex-col gap-5 px-5 pt-5">
        <FormStep n={1} id={`${id}-where`} title="Where Should It Post?">
          <DestinationPicker
            inputRef={firstRef}
            value={kind}
            onChange={(next) => {
              setKind(next);
              setError(null);
            }}
          />
        </FormStep>

        <FormStep n={2} id={`${id}-address`} title="Connect It">
          <div className="flex flex-col gap-4">
            <ConnectPanel kind={kind} guideId={`${id}-how`}>
              <label className={LABEL}>
                {words.field}
                <input
                  ref={urlRef}
                  className={`${INPUT} mt-1.5 font-mono ${addressError ? INVALID : ''}`}
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={words.placeholder}
                  maxLength={WEBHOOK_URL_MAX}
                  value={url}
                  onChange={(event) => {
                    setUrl(event.target.value);
                    // Typing a new address clears what was said of the old one.
                    if (addressError) setError(null);
                  }}
                  aria-invalid={addressError || undefined}
                  aria-describedby={addressError ? `${id}-url-error ${id}-how` : `${id}-how`}
                  required
                />
              </label>
              {addressError ? (
                <p
                  id={`${id}-url-error`}
                  role="alert"
                  className="-mt-2 text-sm text-rose-700 dark:text-rose-300"
                >
                  {webhookError(error, kind)}
                </p>
              ) : null}
            </ConnectPanel>
            <div>
              <label className={LABEL}>
                Name
                <input
                  className={`${INPUT} mt-1.5`}
                  placeholder={words.namePlaceholder}
                  maxLength={WEBHOOK_NAME_MAX}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  aria-describedby={`${id}-name-help`}
                  required
                />
              </label>
              <p id={`${id}-name-help`} className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                A label for you, like the channel it posts to.
              </p>
            </div>
          </div>
        </FormStep>
      </div>
      {/* The actions stick to the foot of the form's scroll, so Cancel and Add Connection stay in reach whatever the
          form's length or wherever an error has taken the keyboard. */}
      <div className="sticky bottom-0 z-[1] mt-5 flex flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 dark:border-slate-700/70 dark:bg-slate-900">
        {error && !addressError ? <ErrorNote>{webhookError(error, kind)}</ErrorNote> : null}
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
          <p
            aria-live="polite"
            className="mr-auto text-xs text-slate-500 empty:hidden dark:text-slate-400"
          >
            {missing ? `Add ${missing} to finish.` : ''}
          </p>
          <button type="button" className={BUTTON.secondary} onClick={onCancel}>
            Cancel
          </button>
          <Button
            type="submit"
            variant="none"
            className={BUTTON.primary}
            // Only what the form lacks disables it. While it adds, it keeps the keyboard (busy-buttons.md): a
            // disabled button drops it to the dialog's top, and an error then left the person nowhere near it.
            disabled={missing !== null}
            busy={busy}
          >
            {busy ? 'Adding…' : 'Add Connection'}
          </Button>
        </div>
      </div>
    </form>
  );
}
