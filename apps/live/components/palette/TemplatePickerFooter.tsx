import { Button } from '@livediagram/ui';
import { ArrowRightIcon, FolderOpenIcon, SparkleIcon, Spinner } from './template-picker-icons';

// The TemplatePicker's footer row (spec/14), lifted out of the picker:
// identity mode keeps a flat Cancel + Join pair; both wizard modes
// (welcome + templates) swap controls per step. The picker hides it
// entirely while the theme builder is open (the builder carries its own
// Save / Cancel), so that gate stays at the call site.
export function TemplatePickerFooter({
  isIdentity,
  isWelcome,
  step,
  busy,
  onSkip,
  onOpenExisting,
  skipToDefaults,
  goToStep,
  onCommit,
}: {
  isIdentity: boolean;
  isWelcome: boolean;
  step: 'template' | 'theme' | 'settings';
  busy: boolean;
  onSkip: () => void;
  onOpenExisting?: () => void;
  skipToDefaults: () => void;
  goToStep: (step: 'template' | 'theme' | 'settings') => void;
  // Commit the current pick — Join in identity mode, Create on the welcome
  // wizard's Settings step, Apply on the in-editor templates theme step.
  onCommit: () => void;
}) {
  return (
    <>
      {/* Footer. Identity mode keeps a flat Cancel + Join row. Both wizard
        modes (welcome + templates) swap controls per step, and the
        footer hides entirely while the theme step's builder is open
        (the builder carries its own Save / Cancel). */}
      {isIdentity ? (
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <p className="mr-auto text-[11px] text-slate-500 dark:text-slate-400">
            Other participants will see this name on your cursor and comments.
          </p>
          <Button variant="secondary" size="xs" onClick={onSkip}>
            Cancel
          </Button>
          <Button size="xs" onClick={onCommit} className="gap-1.5 px-4 shadow-sm">
            <SparkleIcon />
            Join
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          {/* Far-left escape hatch: the welcome flow jumps to the Explorer
            to open an existing diagram; the in-editor templates flow
            cancels back to the canvas. */}
          {isWelcome ? (
            onOpenExisting ? (
              <button
                type="button"
                onClick={onOpenExisting}
                className="mr-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <FolderOpenIcon />
                Open Existing Diagram
              </button>
            ) : null
          ) : (
            <Button
              variant="secondary"
              size="xs"
              onClick={onSkip}
              // rounded-lg + py-2 keep the wizard footer's taller rhythm;
              // overrides append after the size scale, so they win.
              className="mr-auto rounded-lg py-2"
            >
              Cancel
            </Button>
          )}
          {/* Right cluster: (welcome only) Skip, then the primary Next /
            commit action. Going BACK to the template step is driven by
            the step rail at the top (clicking "1 Template") — a footer
            Back button here read ambiguously against the category
            "All templates / All themes" bar, so it's gone. */}
          {isWelcome && step === 'template' ? (
            /* Skip the wizard: Blank template, Basic theme (spec/14).
             Only on the first (template) step — once the user has
             reached the theme step, Back / Create are the actions. */
            <Button
              variant="secondary"
              size="xs"
              onClick={skipToDefaults}
              disabled={busy}
              className="rounded-lg py-2"
            >
              Skip
            </Button>
          ) : null}
          {/* Advance vs commit. The welcome wizard has three steps
            (template -> theme -> settings), so Next carries the user from
            template to theme and from theme to settings, and only the
            Settings step commits (Create). The in-editor templates flow
            has no Settings step, so its theme step commits (Apply). */}
          {step === 'template' || (step === 'theme' && isWelcome) ? (
            <Button
              size="xs"
              onClick={() => goToStep(step === 'template' ? 'theme' : 'settings')}
              className="gap-1.5 rounded-lg px-4 py-2 shadow-sm"
            >
              Next
              <ArrowRightIcon />
            </Button>
          ) : (
            <Button
              size="xs"
              onClick={onCommit}
              disabled={busy}
              className="gap-1.5 rounded-lg px-4 py-2 shadow-sm"
            >
              {busy ? <Spinner /> : <SparkleIcon />}
              {busy ? 'Creating…' : isWelcome ? 'Create' : 'Apply'}
            </Button>
          )}
        </div>
      )}
    </>
  );
}
