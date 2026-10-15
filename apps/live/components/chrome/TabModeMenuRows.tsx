import { EDITOR_MODE_ICONS } from '@livediagram/ui';
import { EDITOR_MODE_CATALOGUE, crossesPlan, type EditorMode } from '@livediagram/document';
import { useState, type ReactNode } from 'react';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import { OpenIcon } from '@/components/primitives/explorer-icons';
import { useLockedModePick } from '@/components/chrome/editor-mode/useLockedModePick';
import { useMenuItemProps } from '@/components/primitives/menu-item-props';

// "Mode" (docs/specs/007-editor/editor-modes.md "Where the mode lives"): the tab menu's choice of
// the tab's editor mode, the same for everyone. Choosing one switches the tab, exactly as the mode
// switch does, and is a phone's way to switch. Every mode of the catalogue is a one-of-a-set choice,
// so a further mode joins here without a change to this file. The host leaves `choice` out where it
// is not offered (an event-storming board, a visitor who cannot edit, a locked tab).

export type TabModeChoice = {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
  // A new tab in a mode across Plan's line; absent where the session cannot add tabs (those rows show, inert).
  newTabIn?: ((mode: EditorMode) => void) | undefined;
};

// "Mode", one section closed until opened (docs/specs/007-editor/editor-modes.md "Mode in the tab menu"), holding every
// mode: one beside the tab's own switches it, one across Plan's line asks for a new tab in it, as the switch does.
export function TabModeMenuRows({ choice }: { choice: TabModeChoice }) {
  const [open, setOpen] = useState(false);
  const pickLocked = useLockedModePick({ mode: choice.mode, newTabIn: choice.newTabIn });
  const CurrentIcon = EDITOR_MODE_ICONS[choice.mode];
  return (
    <MenuAccordionSection
      title="Mode"
      icon={<CurrentIcon className="h-4 w-4" />}
      open={open}
      onToggle={() => setOpen((v) => !v)}
      flush
    >
      <div role="group" aria-label="Mode" className="flex flex-col">
        {EDITOR_MODE_CATALOGUE.map(({ id, label }) => {
          const Icon = EDITOR_MODE_ICONS[id];
          const checked = id === choice.mode;
          const crossing = crossesPlan(choice.mode, id);
          const inert = crossing && !choice.newTabIn;
          return (
            <TabModeChoiceRow
              key={id}
              checked={checked}
              inert={inert}
              onClick={() => {
                if (checked || inert) return;
                if (crossing) void pickLocked(id);
                else choice.onChange(id);
              }}
              className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-slate-700 transition dark:text-slate-200 ${
                inert
                  ? 'cursor-not-allowed opacity-50'
                  : 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span className="flex w-4 shrink-0 items-center justify-center">
                <Icon className="h-4 w-4" />
              </span>
              {/* The mode's name alone, no description line: the tab menu stays short. */}
              <span className="min-w-0 flex-1 text-[13px] font-medium">{label}</span>
              {crossing ? (
                // Across Plan's line: a new tab, marked as the switch marks it.
                <OpenIcon aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              ) : (
                <span
                  aria-hidden
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    checked ? 'bg-brand-600 dark:bg-brand-400' : 'bg-transparent'
                  }`}
                />
              )}
            </TabModeChoiceRow>
          );
        })}
      </div>
    </MenuAccordionSection>
  );
}

// One mode: inside the Tab control menu a toggle button (aria-pressed, D55), as every one-of-a-set
// tile there is; inside a command menu it would be a menuitemradio.
function TabModeChoiceRow({
  checked,
  inert,
  onClick,
  className,
  children,
}: {
  checked: boolean;
  inert: boolean;
  onClick: () => void;
  className: string;
  children: ReactNode;
}) {
  const { inCommandMenu, itemProps } = useMenuItemProps({ checked, radio: true });
  return (
    <button
      type="button"
      {...itemProps}
      aria-pressed={inCommandMenu ? undefined : checked}
      aria-disabled={inert || undefined}
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  );
}
