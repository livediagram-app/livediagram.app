import { EDITOR_MODE_CATALOGUE, type EditorMode } from '@livediagram/document';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import { EDITOR_MODE_ICON } from './editor-mode/editor-mode-copy';
import { useOfferedEditorModes } from '@/lib/offered-editor-modes';

// "Opens in" (docs/specs/007-editor/editor-modes.md "Where the mode lives"): the tab menu's choice
// of the editor mode a general tab opens in, for everyone. Every mode of the catalogue is a radio
// choice, so a further mode joins here without a change to this file. Choosing one also switches
// the chooser's own mode, so the already-checked choice still passes through (it switches back). The host leaves `choice` out where it is not offered (an event-storming
// board, a visitor who cannot edit).

export type OpensInChoice = {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
  // A locked tab keeps its opening mode: the choices show, greyed.
  disabled: boolean;
};

export function OpensInMenuSection({
  choice,
  open,
  onToggle,
}: {
  choice: OpensInChoice;
  open: boolean;
  onToggle: () => void;
}) {
  const Current = EDITOR_MODE_ICON[choice.mode];
  // An experimental mode switched off in Settings is not offered (offered-editor-modes).
  const offered = useOfferedEditorModes();
  return (
    <MenuAccordionSection
      title="Opens in"
      icon={<Current className="h-3.5 w-3.5" />}
      open={open}
      onToggle={onToggle}
      flush
    >
      <div role="group" aria-label="Opens in" className="flex flex-col">
        {EDITOR_MODE_CATALOGUE.filter((m) => offered.includes(m.id)).map(
          ({ id, label, description }) => {
            const Icon = EDITOR_MODE_ICON[id];
            const checked = id === choice.mode;
            return (
              <button
                key={id}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                aria-disabled={choice.disabled || undefined}
                onClick={() => {
                  if (choice.disabled) return;
                  choice.onChange(id);
                }}
                className={`flex w-full items-start gap-2.5 px-3 py-1.5 text-left transition ${
                  choice.disabled
                    ? 'cursor-not-allowed text-slate-300 dark:text-slate-600'
                    : 'cursor-pointer text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <span className="mt-0.5 flex w-4 shrink-0 items-center justify-center">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[13px] font-medium">{label}</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {description}
                  </span>
                </span>
                <span
                  aria-hidden
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    checked ? 'bg-brand-600 dark:bg-brand-400' : 'bg-transparent'
                  }`}
                />
              </button>
            );
          },
        )}
      </div>
    </MenuAccordionSection>
  );
}
