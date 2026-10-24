'use client';

// The account control's light entry (`/placeholder`): what a header can show without loading the menu.
import { useCallback, useRef, useState, type ComponentType } from 'react';
import { ACCOUNT_TRIGGER_CLASS, ChevronGlyph, GUEST_LABEL, GuestAvatar } from './face';

// The account menu's footprint while its code or its name is on the way: the avatar's disc, in the place the
// trigger will take, so the bar doesn't jump when it arrives.
export function AccountMenuPlaceholder() {
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center py-1 pr-2.5 pl-1">
      <span className="size-7 rounded-full bg-slate-200 dark:bg-slate-800" />
    </span>
  );
}

/** What the menu's own chunk renders in the stand-in's place: open, or focused, as the stand-in was left. */
export type DeferredMenuProps = { openOnMount?: boolean; focusOnMount?: boolean };

/** The Guest button on a page that must cost a visitor nothing (an app's marketing header, liveworkspace/docs/site.md
 *  "The header"): the account menu's Guest trigger, drawn here with none of the menu's code. `load` fetches the menu's
 *  chunk when the pointer or focus reaches the button; a press made before it arrives opens the menu once it has. */
export function DeferredAccountMenu({
  load,
}: {
  load: () => Promise<{ default: ComponentType<DeferredMenuProps> }>;
}) {
  const [menu, setMenu] = useState<{ Menu: ComponentType<DeferredMenuProps> } | null>(null);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const asked = useRef(false);
  const want = useCallback(() => {
    if (asked.current) return;
    asked.current = true;
    load().then(
      (module) => setMenu({ Menu: module.default }),
      // Not fetched (offline, say): the next approach asks again.
      () => {
        asked.current = false;
      },
    );
  }, [load]);

  if (menu) return <menu.Menu openOnMount={pressed} focusOnMount={focused} />;
  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={false}
        aria-label={`${GUEST_LABEL}, account menu`}
        onPointerEnter={want}
        onFocus={() => {
          setFocused(true);
          want();
        }}
        onBlur={() => setFocused(false)}
        onClick={() => {
          setPressed(true);
          want();
        }}
        className={ACCOUNT_TRIGGER_CLASS}
      >
        <GuestAvatar />
        <span className="truncate max-sm:hidden">{GUEST_LABEL}</span>
        <ChevronGlyph className="size-4 shrink-0 text-slate-400" />
      </button>
    </div>
  );
}
