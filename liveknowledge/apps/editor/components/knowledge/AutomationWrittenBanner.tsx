'use client';

// A page a rule in another app wrote (docs/specs/013-workspace/automations.md "Steps in other apps"): until someone
// verifies it, a calm line above the meta row says which rule wrote it and that nobody has checked it, with Mark
// Verified for whoever may verify. Amber like Changed since verified: something to read before trusting, never an
// error. Gone once the page is verified.
import type { PageAuthorStamp } from '@liveknowledge/api-schema';
import { automationRuleWords } from '@/lib/knowledge/page-makers';

// The writer in the same words as the meta row's Written by a Rule pill (page-makers.ts).
export function automationBannerText(stamp: PageAuthorStamp): string {
  return `Written by ${automationRuleWords(stamp)}. Never verified.`;
}

export function AutomationWrittenBanner({
  stamp,
  verified,
  onVerify,
}: {
  stamp: PageAuthorStamp | undefined;
  verified: boolean;
  // Absent for whoever may not verify: the line stands without the action.
  onVerify?: (() => void) | undefined;
}) {
  if (!stamp || stamp.via !== 'automation' || verified) return null;
  return (
    <div
      data-automation-written=""
      role="note"
      className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-sans text-[13px] leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <span>{automationBannerText(stamp)}</span>
      {onVerify ? (
        <button
          type="button"
          data-automation-verify=""
          onClick={onVerify}
          className="cursor-pointer rounded-md font-medium text-amber-900 underline decoration-amber-400 underline-offset-2 hover:decoration-amber-700 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-amber-100"
        >
          Mark Verified
        </button>
      ) : null}
    </div>
  );
}
