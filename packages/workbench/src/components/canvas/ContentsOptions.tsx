'use client';

// Contents Options (each product's docs/specs/007-editor/pages-mode.md "Contents"): the cog at the foot of the docked
// Contents, right of Add Page, opening a small menu above it: Collapse Contents (tuck it into its cluster button, for
// everyone who has Contents) and, where the editor offers it, Stack Pages (the tab's pages one in front with the rest
// fanned behind, or side by side), an Editor's switch.
import { useState } from 'react';
import { lucideLayers, lucidePanelLeftClose, lucideSettings } from '@liveworkspace/icons/lucide';
import { lucideGlyph, Switch, Tooltip } from '@liveworkspace/ui';
import { MenuActionRow, MenuGroupSeparator, PortalMenu } from '../primitives/PortalMenu';
import { useMenuItemProps } from '../primitives/menu-item-props';

const CogIcon = lucideGlyph(lucideSettings, 16);
const CollapseIcon = lucideGlyph(lucidePanelLeftClose, 16);
const StackIcon = lucideGlyph(lucideLayers, 16);

export type ContentsStackOption = { on: boolean; onToggle: () => void };

// Square, the height of the foot's Add Page, in its outline; tinted while its menu is open.
const COG_BUTTON =
  'flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border transition focus-visible:outline-2 focus-visible:outline-brand-600';
const COG_REST =
  'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-400/60 dark:hover:bg-brand-500/20 dark:hover:text-brand-100';
const COG_OPEN =
  'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-400/60 dark:bg-brand-500/20 dark:text-brand-100';

/** The Stack Pages row: a checkable menu item, its switch drawn at the right. Stays open on a press, as a switch. */
function StackPagesRow({ on, onToggle }: ContentsStackOption) {
  const { itemProps } = useMenuItemProps({ checked: on });
  return (
    <button
      type="button"
      {...itemProps}
      aria-checked={on}
      role={itemProps.role ?? 'switch'}
      data-contents-stack=""
      onClick={onToggle}
      className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-[13px] text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <span className="flex w-5 shrink-0 items-center justify-center text-slate-400 [&_svg]:h-4 [&_svg]:w-4">
        <StackIcon />
      </span>
      <span className="min-w-0 flex-1">Stack Pages</span>
      <Switch presentational checked={on} size="sm" />
    </button>
  );
}

export function ContentsOptions({
  onCollapse,
  stack,
}: {
  onCollapse: () => void;
  // Absent where the tab's pages stand only one way, or the viewer may not change it.
  stack?: ContentsStackOption | undefined;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip label="Contents Options">
        <button
          ref={setAnchor}
          type="button"
          aria-label="Contents Options"
          aria-haspopup="menu"
          aria-expanded={open}
          data-contents-options=""
          data-contents-minimise=""
          onClick={() => setOpen((o) => !o)}
          className={`${COG_BUTTON} ${open ? COG_OPEN : COG_REST}`}
        >
          <CogIcon />
        </button>
      </Tooltip>
      {open ? (
        <PortalMenu
          anchor={anchor}
          placement="above"
          onClose={() => setOpen(false)}
          landmark="Contents Options"
          label="Contents Options"
        >
          {stack ? (
            <>
              <StackPagesRow on={stack.on} onToggle={stack.onToggle} />
              <MenuGroupSeparator />
            </>
          ) : null}
          <MenuActionRow
            plain
            icon={<CollapseIcon />}
            label="Collapse Contents"
            onClick={() => {
              setOpen(false);
              onCollapse();
            }}
          />
        </PortalMenu>
      ) : null}
    </>
  );
}
