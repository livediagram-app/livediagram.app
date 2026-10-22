// A form link's page talking to the api (docs/specs/030-forms/forms.md "Filling in a form"): plain fetches, no
// identity and no editor modules, so the page stays small. Every failure comes back as a value the page can say.
import type {
  FormReportReason,
  FormResponseAccepted,
  FormResponseRefusal,
  PublicFormResponse,
} from '@livedesign/api-schema';
import { API_BASE } from './base';

const formUrl = (code: string, door = '') =>
  `${API_BASE}/forms/${encodeURIComponent(code)}${door ? `/${door}` : ''}`;

type FormLoad =
  { kind: 'ok'; data: PublicFormResponse } | { kind: 'not_found' } | { kind: 'error' };

export async function loadPublicForm(
  code: string,
  fetcher: typeof fetch = fetch,
): Promise<FormLoad> {
  try {
    const res = await fetcher(formUrl(code), { cache: 'no-store' });
    if (res.status === 404) return { kind: 'not_found' };
    if (!res.ok) return { kind: 'error' };
    return { kind: 'ok', data: (await res.json()) as PublicFormResponse };
  } catch {
    return { kind: 'error' };
  }
}

type SendResult =
  | { kind: 'sent'; number: number }
  | { kind: 'refused'; refusal: FormResponseRefusal }
  | { kind: 'offline' };

export async function sendFormResponse(
  code: string,
  body: { answers: Record<string, unknown>; other: Record<string, unknown>; website: string },
  fetcher: typeof fetch = fetch,
): Promise<SendResult> {
  try {
    const res = await fetcher(formUrl(code, 'responses'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 201)
      return { kind: 'sent', number: ((await res.json()) as FormResponseAccepted).number };
    if (res.status === 429 && !(await peekError(res)))
      return { kind: 'refused', refusal: { error: 'rate_limited' } };
    const refusal = (await res.json().catch(() => null)) as FormResponseRefusal | null;
    // A server fault is not a refusal of the answers: said as a failed send.
    if (res.status >= 500) return { kind: 'offline' };
    return refusal && 'error' in refusal ? { kind: 'refused', refusal } : { kind: 'offline' };
  } catch {
    return { kind: 'offline' };
  }
}

// Whether a 429 names its own error (form_busy) rather than the network limiter's bare one.
async function peekError(res: Response): Promise<boolean> {
  const text = await res
    .clone()
    .text()
    .catch(() => '');
  return text.includes('form_busy');
}

export async function reportForm(
  code: string,
  report: { reason: FormReportReason; note: string; browser: string },
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const res = await fetcher(formUrl(code, 'reports'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });
    return res.ok;
  } catch {
    return false;
  }
}
