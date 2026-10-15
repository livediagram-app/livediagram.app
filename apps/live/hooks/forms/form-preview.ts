// Submit in the builder's Preview (docs/specs/030-forms/forms.md "Preview"): an Editor's preview makes the card a
// response would, titled "Preview: …" and not counted as a response, so the whole road from question to card can be
// tried before the link goes out. The answers are checked as the api checks them.
import type { ItemCreate, ItemTypeDef } from '@livediagram/items';
import { checkResponse, responseCard, type FormDefinition } from '@livediagram/forms';
import type { FillState, SubmitOutcome } from '@/components/forms/respond/useFormFill';
import { track } from '@/lib/telemetry';

export const PREVIEW_NO_DESTINATION =
  'Preview can’t add its card until Responses Go To names a board and column.';
export const PREVIEW_FAILED = 'Preview couldn’t add its card. Try again.';

export async function sendPreview({
  form,
  tabId,
  type,
  problem,
  addItems,
  state,
}: {
  form: FormDefinition;
  tabId: string;
  // The destination's card type, and why the destination cannot take a card (null when it can).
  type: ItemTypeDef | undefined;
  problem: unknown;
  addItems: ((creates: readonly ItemCreate[]) => Promise<boolean>) | undefined;
  state: FillState;
}): Promise<SubmitOutcome> {
  const checked = checkResponse(form, state);
  if (!checked.ok) return { kind: 'invalid', errors: checked.errors };
  if (problem || !type || !form.destination || !addItems) {
    console.info('[forms] form.preview.no_destination', { problem });
    return { kind: 'failed', message: PREVIEW_NO_DESTINATION };
  }
  const card = responseCard(form, tabId, checked.answers, type, 'preview');
  const made = await addItems([
    { type: card.type, fields: card.fields, place: { status: form.destination.status } },
  ]);
  if (!made) {
    console.warn('[forms] form.preview.failed');
    return { kind: 'failed', message: PREVIEW_FAILED };
  }
  track('Form', 'Sent', 'Preview');
  return { kind: 'sent' };
}
