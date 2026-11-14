'use client';

// The account control's light entry (`/placeholder`): what a header can show without loading the menu.
import { useCallback, useRef, useState, type ComponentType } from 'react';
import {
  ACCOUNT_TRIGGER_BOX,
  ACCOUNT_TRIGGER_CLASS,
  ChevronGlyph,
  GUEST_LABEL,
  GuestAvatar,
} from './face';
import { ACCOUNT_PALETTE } from './palette';

// The account menu's footprint while its code or its name is on the way: the avatar's disc, with the room for
// "Guest" and the chevron kept but unseen, in the trigger's box (ACCOUNT_TRIGGER_BOX), so the Guest button
// takes its place without moving the bar (a visitor's header, hydrating late, shifted its Explorer link 8.7px).
export function AccountMenuPlaceholder() {
  return (
    <span aria-hidden className={`shrink-0 ${ACCOUNT_TRIGGER_BOX} ${ACCOUNT_PALETTE}`}>
      <span className="size-7 shrink-0 rounded-full bg-(--account-pending)" />
      <span className="invisible truncate max-sm:hidden">{GUEST_LABEL}</span>
      <ChevronGlyph className="invisible size-4 shrink-0" />
    </span>
  );
}

/** What the menu's own chunk renders in the stand-in's place: open, or focused, as the stand-in was left. */
export type DeferredMenuProps = { openOnMount?: boolean; focusOnMount?: boolean };

/** The Guest button on a page that must cost a visitor nothing (an app's marketing header, liveworkspace/docs/specs/010-site/site.md
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
  // A pointer held down on the stand-in, and the menu's code if it landed meanwhile. Swapped mid-press, the press
  // would go down on the stand-in and come up on the menu's button, and a click on neither would open nothing.
  const holding = useRef(false);
  const landed = useRef<ComponentType<DeferredMenuProps> | null>(null);
  const want = useCallback(() => {
    if (asked.current) return;
    asked.current = true;
    load().then(
      (module) => {
        if (holding.current) landed.current = module.default;
        else setMenu({ Menu: module.default });
      },
      // Not fetched (offline, say): the next approach asks again.
      () => {
        asked.current = false;
      },
    );
  }, [load]);
  // The press is over (its click, or a pointer that left or was cancelled): what landed meanwhile takes its place.
  const release = () => {
    holding.current = false;
    const Menu = landed.current;
    landed.current = null;
    if (Menu) setMenu({ Menu });
  };

  if (menu) return <menu.Menu openOnMount={pressed} focusOnMount={focused} />;
  return (
    <div className={`relative ${ACCOUNT_PALETTE}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={false}
        aria-label={`${GUEST_LABEL}, account menu`}
        onPointerEnter={want}
        onPointerDown={() => {
          holding.current = true;
          want();
        }}
        // Up on the button, its click follows in the same task: released after it, so the click lands here first.
        onPointerUp={() => setTimeout(release, 0)}
        onPointerCancel={release}
        onPointerLeave={(e) => {
          // A mouse press dragged off the button is no click: it lands with nothing pressed. (A touch leaves only
          // after it is lifted, before its click, so it waits for that.)
          if (holding.current && e.pointerType !== 'touch') release();
        }}
        onFocus={() => {
          setFocused(true);
          want();
        }}
        onBlur={() => setFocused(false)}
        onClick={() => {
          setPressed(true);
          want();
          release();
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
