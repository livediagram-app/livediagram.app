// The words of Publish to the Web (docs/specs/030-knowledgebase/publishing.md "The dialog"): what a refusal says,
// why a page stays private, and how many go public.
import type { PublishingLeftOutReason } from '@liveknowledge/api-schema';
import { siteAddressRefusal } from '@liveknowledge/knowledge';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';

export type PublishAction = 'read' | 'publish' | 'unpublish';

/** What a failed call says, by its refusal's code. */
export function publishFailureText(err: unknown, action: PublishAction): string {
  if (err instanceof ApiError) {
    if (err.code === 'address_taken')
      return 'Another knowledgebase has that address. Choose another.';
    if (err.code === 'address_reserved')
      return 'That address is kept for liveknowledge. Choose another.';
    if (err.code === 'invalid_address') return addressHint('');
    if (err.code === 'nothing_to_publish')
      return 'No page here can go public yet: each one is waiting for approval, rejected, or has no writing.';
    if (err.code === 'invalid_root') return 'That section is no longer in this knowledgebase.';
    if (err.code === 'publishing_unavailable')
      return "Publishing isn't available for this knowledgebase.";
    if (err.code === 'sign_in_required') return 'Sign in to publish this knowledgebase.';
    if (err.code === 'forbidden' || err.code === 'needs_a_person')
      return 'Only an Editor of this knowledgebase can publish it.';
    if (err.status === 429) return 'Too many changes at once. Wait a moment and try again.';
  }
  if (action === 'read') return "What is published couldn't be read. Check your connection.";
  if (action === 'unpublish') return "The site couldn't be unpublished. Check your connection.";
  return "The site couldn't be published. Check your connection.";
}

/** Why an address can't be used, as the field says it, or null when it can. */
export function addressProblem(address: string): string | null {
  const refusal = siteAddressRefusal(address);
  if (refusal === null) return null;
  return refusal === 'address_reserved'
    ? 'That address is kept for liveknowledge. Choose another.'
    : addressHint(address);
}

function addressHint(address: string): string {
  if (address.length > 0 && address.length < 3) return 'An address is at least 3 characters.';
  return 'Use 3 to 48 lowercase letters, numbers and single hyphens, starting and ending with a letter or number.';
}

/** A typed address as the field keeps it: lowercase, spaces as hyphens. */
export const typedAddress = (text: string): string =>
  text.toLowerCase().replace(/\s/g, '-').slice(0, 48);

export const LEFT_OUT_WORDS: Readonly<Record<PublishingLeftOutReason, string>> = {
  pending: 'Pending Approval',
  rejected: 'Rejected',
  empty: 'No Writing Yet',
};

/** "1 page goes public", "12 pages go public". */
export const publicCountText = (n: number): string =>
  n === 1 ? '1 page goes public' : `${n} pages go public`;

/** "Stays private" words for the count left out. */
export const privateCountText = (n: number): string =>
  n === 1 ? '1 page stays private' : `${n} pages stay private`;

/** "Published 21 November 2026", in the reader's own words for the date. */
export const publishedOnText = (at: number, locale?: string): string =>
  `Published ${new Date(at).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}`;
