// Submit in the builder's Preview (docs/specs/030-forms/forms.md "Preview"): an Editor's preview makes the card a
// response would, titled "Preview: …", so the whole road from question to card can be tried. A published form takes
// it as a counted response, through the api; one with no link yet has nothing to count it on, so the editor makes the
// card itself. The answers are checked as the api checks them.
import type { ItemCreate, ItemTypeDef } from '@livepages/items';
import { checkResponse, responseCard, type FormDefinition } from '@livepages/forms';
import type { FillState, SubmitOutcome } from '@/components/forms/respond/useFormFill';
import type { PreviewSend } from '@/lib/api/forms';
import { debugLog } from '@/lib/debug-log';
import { track } from '@/lib/telemetry';

export const PREVIEW_NO_DESTINATION =
  'Preview can’t add its card until Responses Go To names a board and column.';
export const PREVIEW_FAILED = 'Preview couldn’t be sent. Try again.';
export const PREVIEW_NO_SHEET =
  'Preview can’t add its row: its sheet was removed. Choose where responses go.';

export async function sendPreview({
  form,
  tabId,
  type,
  problem,
  addItems,
  state,
  sendToLink,
}: {
  form: FormDefinition;
  tabId: string;
  // The destination's card type, and why the destination cannot take a card (null when it can).
  type: ItemTypeDef | undefined;
  problem: unknown;
  addItems: ((creates: readonly ItemCreate[]) => Promise<boolean>) | undefined;
  state: FillState;
  // The form's live link takes it as a response (absent offline, or for a form never published).
  sendToLink?: ((state: FillState) => Promise<PreviewSend>) | undefined;
}): Promise<SubmitOutcome> {
  const checked = checkResponse(form, state);
  if (!checked.ok) return { kind: 'invalid', errors: checked.errors };
  // A Sheet no longer in the document takes no row: say so rather than send it nowhere.
  if (form.sheet && problem) {
    debugLog('[forms] form.preview.no_sheet', { problem });
    return { kind: 'failed', message: PREVIEW_NO_SHEET };
  }
  if (sendToLink) {
    const sent = await sendToLink(state);
    // The api counts it (Form·Sent·Preview, server-side).
    if (sent.kind === 'sent') return { kind: 'sent' };
    if (sent.kind === 'invalid') return { kind: 'invalid', errors: sent.errors };
    if (sent.kind === 'failed') {
      console.warn('[forms] form.preview.failed');
      return { kind: 'failed', message: PREVIEW_FAILED };
    }
  }
  // A Sheet's row is the api's to write: with no way to reach it there is nothing to add.
  if (form.sheet) return { kind: 'failed', message: PREVIEW_FAILED };
  if (problem || !type || !form.destination || !addItems) {
    debugLog('[forms] form.preview.no_destination', { problem });
    return { kind: 'failed', message: PREVIEW_NO_DESTINATION };
  }
  const card = responseCard(form, tabId, checked.answers, type, null, true);
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
