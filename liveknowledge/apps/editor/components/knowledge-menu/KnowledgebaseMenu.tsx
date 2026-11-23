'use client';

// The knowledgebase's menu (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The knowledgebase's menu"):
// the knowledgebase's name in the sidebar's head is the menu's button, a chevron beside it, and the menu is
// icon-left verb rows under the name. The shared menu primitives give it the arrow keys, Home and End, typeahead,
// Escape back to the button, and the menu role; the button says it has a menu and whether it is open. On a phone
// the same menu opens from the Pages sheet's head, its button 44 px tall. A name typed at the open menu renames
// (typed-rename.ts).
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { HoverCard } from '@liveknowledge/ui';
import {
  MenuActionRow,
  MenuGroupSeparator,
  MenuHeader,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import {
  AiIcon,
  DeleteIcon,
  DescribeIcon,
  ExportIcon,
  ImportIcon,
  MenuChevronIcon,
  PublishIcon,
  RenameIcon,
} from './knowledge-menu-icons';
import { useKnowledgebaseMenu, type KnowledgeMenuVerb } from './useKnowledgebaseMenu';
import { NO_TYPED_NAME, typedNameKey } from './typed-rename';

const ICONS: Record<KnowledgeMenuVerb, ReactNode> = {
  rename: <RenameIcon />,
  describe: <DescribeIcon />,
  import: <ImportIcon />,
  export: <ExportIcon />,
  publish: <PublishIcon />,
  ai: <AiIcon />,
  delete: <DeleteIcon />,
};

export function KnowledgebaseMenu({
  name,
  onRename,
  touch = false,
  onChosen,
}: {
  // The knowledgebase's name as shown ("Untitled Knowledgebase" for none).
  name: string;
  // Starts the rename where the name stands, from a name typed at the open menu when there is one; undefined where
  // this session may not rename.
  onRename?: ((typed?: string) => void) | undefined;
  // A phone's sheet: the button is 44 px tall.
  touch?: boolean;
  // Told as a row is chosen, before it runs (the sheet closes for a row that opens a dialog).
  onChosen?: (verb: KnowledgeMenuVerb) => void;
}) {
  // In state, not a ref: the menu is anchored to it during render.
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  // The letters typed at the open menu so far (typed-rename.ts).
  const typed = useRef(NO_TYPED_NAME);
  const rows = useKnowledgebaseMenu(onRename ? () => onRename() : undefined);
  // Nothing to choose (an embed): the name alone.
  if (rows.length === 0)
    return (
      <p
        data-knowledgebase-name=""
        className="min-w-0 flex-1 truncate px-1.5 py-1 text-sm font-semibold"
      >
        {name}
      </p>
    );
  // Only where Rename is a row: a session the menu offers no Rename types to the menu alone.
  const renames = rows.some((r) => r.verb === 'rename');
  const last = rows[rows.length - 1];
  const destructive = last?.verb === 'delete' ? last : null;
  const verbs = destructive ? rows.slice(0, -1) : rows;
  // A name typed at the open menu (typed-rename.ts): its letters spell rows until one spells none, which starts Rename
  // with all of them. Also on the button, for keys typed before the menu has taken focus.
  const onTyping = (e: KeyboardEvent<HTMLElement>) => {
    if (!renames || e.nativeEvent.isComposing) return;
    const step = typedNameKey(
      typed.current,
      { key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, at: e.timeStamp },
      rows.map((r) => r.label),
    );
    if (!step) return;
    if (step.kind === 'search') {
      typed.current = step.typed;
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    typed.current = NO_TYPED_NAME;
    setOpen(false);
    onChosen?.('rename');
    onRename?.(step.text);
  };
  const row = (r: (typeof rows)[number]) => (
    <MenuActionRow
      key={r.verb}
      plain
      label={r.label}
      icon={ICONS[r.verb]}
      onClick={() => {
        setOpen(false);
        onChosen?.(r.verb);
        r.run();
      }}
    />
  );
  return (
    <>
      <HoverCard
        block
        className="min-w-0 flex-1"
        title={name}
        description="Rename, style, import, export and more."
      >
        <button
          ref={setButton}
          type="button"
          data-knowledgebase-name=""
          data-knowledgebase-menu=""
          aria-label={`${name}: Knowledgebase Menu`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => {
            typed.current = NO_TYPED_NAME;
            setOpen((was) => !was);
          }}
          // Down Arrow opens it from the keyboard, as it opens every menu button (docs/specs/004-interface-design/
          // menus.md); Enter and Space are the button's own press.
          onKeyDown={(e) => {
            if (open) {
              onTyping(e);
              return;
            }
            if (e.key !== 'ArrowDown') return;
            e.preventDefault();
            typed.current = NO_TYPED_NAME;
            setOpen(true);
          }}
          className={`flex w-full min-w-0 cursor-pointer items-center gap-1 rounded-md px-1.5 text-left text-sm font-semibold text-slate-900 motion-safe:transition-colors motion-safe:duration-micro hover:bg-slate-200/70 focus-visible:outline-2 focus-visible:outline-brand-600 aria-expanded:bg-slate-200/70 dark:text-slate-100 dark:hover:bg-slate-800 dark:aria-expanded:bg-slate-800 ${
            touch ? 'min-h-11' : 'min-h-8'
          }`}
        >
          <span className="min-w-0 truncate">{name}</span>
          <span aria-hidden className="shrink-0 text-slate-500 dark:text-slate-400">
            <MenuChevronIcon />
          </span>
        </button>
      </HoverCard>
      {open ? (
        // In the capture phase, ahead of the menu's own keys (useMenu listens on the menu itself): a letter that
        // spells no row starts Rename with the name typed so far.
        <div className="contents" onKeyDownCapture={onTyping}>
          <PortalMenu
            anchor={button}
            placement="below"
            onClose={() => setOpen(false)}
            label="Knowledgebase Menu"
          >
            <MenuHeader title={name} />
            {verbs.map(row)}
            {destructive && verbs.length > 0 ? <MenuGroupSeparator /> : null}
            {destructive ? row(destructive) : null}
          </PortalMenu>
        </div>
      ) : null}
    </>
  );
}
