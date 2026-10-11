import { EDITOR_MODE_ICONS } from '@livediagram/ui';
import { EDITOR_MODE_CATALOGUE, crossesPlan, type EditorMode } from '@livediagram/document';
import type { ReactNode } from 'react';
import { useMenuItemProps } from '@/components/primitives/menu-item-props';

// "Mode" (docs/specs/007-editor/editor-modes.md "Where the mode lives"): the tab menu's choice of
// the tab's editor mode, the same for everyone. Choosing one switches the tab, exactly as the mode
// switch does, and is a phone's way to switch. Every mode of the catalogue is a one-of-a-set choice,
// so a further mode joins here without a change to this file. The host leaves `choice` out where it
// is not offered (an event-storming board, a visitor who cannot edit, a locked tab).

export type TabModeChoice = {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
};

// The modes as full-width rows straight in the menu, not behind a category: the tab menu is short
// enough now to show them (docs/specs/007-editor/editor-modes.md "Where the mode lives").
export function TabModeMenuRows({ choice }: { choice: TabModeChoice }) {
  // Plan stands apart (crossesPlan): a Plan tab offers no other mode, and no other tab offers Plan.
  const modes = EDITOR_MODE_CATALOGUE.filter(({ id }) => !crossesPlan(choice.mode, id));
  if (modes.length < 2) return null;
  return (
    <div role="group" aria-label="Mode" className="flex flex-col">
      {modes.map(({ id, label }) => {
        const Icon = EDITOR_MODE_ICONS[id];
        const checked = id === choice.mode;
        return (
          <TabModeChoiceRow
            key={id}
            checked={checked}
            onClick={() => {
              if (!checked) choice.onChange(id);
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-1.5 text-left text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <span className="flex w-4 shrink-0 items-center justify-center">
              <Icon className="h-4 w-4" />
            </span>
            {/* The mode's name alone, no description line: the tab menu stays short. */}
            <span className="min-w-0 flex-1 text-[13px] font-medium">{label}</span>
            <span
              aria-hidden
              className={`h-2 w-2 shrink-0 rounded-full ${
                checked ? 'bg-brand-600 dark:bg-brand-400' : 'bg-transparent'
              }`}
            />
          </TabModeChoiceRow>
        );
      })}
    </div>
  );
}

// One mode: inside the Tab control menu a toggle button (aria-pressed, D55), as every one-of-a-set
// tile there is; inside a command menu it would be a menuitemradio.
function TabModeChoiceRow({
  checked,
  onClick,
  className,
  children,
}: {
  checked: boolean;
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
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  );
}
