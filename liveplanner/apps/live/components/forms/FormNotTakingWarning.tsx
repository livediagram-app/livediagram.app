'use client';

// The status bar's red Not Taking Responses (docs/specs/030-forms/forms.md "Hearing about responses"): an Editor's
// warning, right after the response count, that a published form takes no responses now. Its tooltip says why; a
// press opens where that is fixed. Red (danger), unlike Problems with this Form's amber: responses are being lost.
import { Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucideTriangleAlert } from '@liveplanner/icons/lucide';
import { track } from '@/lib/telemetry';
import {
  FORM_NOT_TAKING,
  type FormNotTakingFix,
  type FormNotTakingReason,
} from './form-not-taking';

const WarningIcon = lucideGlyph(lucideTriangleAlert, 14);

export function FormNotTakingWarning({
  reason,
  onFix,
}: {
  reason: FormNotTakingReason;
  // Opens where the reason is fixed; absent (a full project with no responses tab), the warning only says.
  onFix?: ((fix: FormNotTakingFix) => void) | null;
}) {
  const { text, fix, telemetry } = FORM_NOT_TAKING[reason];
  const body = (
    <>
      <WarningIcon aria-hidden />
      Not Taking Responses
    </>
  );
  const tone = 'flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 font-semibold';
  const colour = 'text-red-700 dark:text-red-300';
  return (
    <Tooltip label={text}>
      {onFix ? (
        <button
          type="button"
          data-form-not-taking={reason}
          aria-label={`Not Taking Responses. ${text}`}
          onClick={() => {
            track('Form', 'Opened', telemetry);
            onFix(fix);
          }}
          className={`${tone} ${colour} cursor-pointer hover:bg-red-50 dark:hover:bg-red-500/10`}
        >
          {body}
        </button>
      ) : (
        <span
          role="status"
          tabIndex={0}
          data-form-not-taking={reason}
          aria-label={`Not Taking Responses. ${text}`}
          className={`${tone} ${colour}`}
        >
          {body}
        </span>
      )}
    </Tooltip>
  );
}
