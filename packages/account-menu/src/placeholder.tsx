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
    <div className={`relative ${ACCOUNT_PALETTE}`}>
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
