'use client';

// The header's Prototype action (docs/specs/007-editor/wireframe-pages.md "Prototype mode"): on a wireframe tab, for
// every role, it plays the tab from the screen in view. A full-height header action like Share and Copy.
import { Glyph, HoverCard } from '@livedesign/ui';
import {
  CORNER_BTN,
  CORNER_TONE,
} from '@liveworkspace/workbench/components/chrome/EditorCornerActions';
import { HeaderGlyph } from '@liveworkspace/workbench/components/chrome/header-action';
import { pagesOf, type Tab } from '@livedesign/design';
import { currentPageIdNow } from '@/lib/current-page-kind';
import type { EditorCapabilities } from '@/lib/editor-capabilities';
import { openPrototype } from '@/lib/prototype-player-store';
import { wireframeTabPages } from '@/lib/screen-link-choices';

/** Whether the header offers Prototype: a wireframe tab, a role that plays (every role), no welcome open. */
export function offersPrototype(
  can: Pick<EditorCapabilities, 'playPrototype'>,
  tab: Pick<Tab, 'pages'>,
  welcomeOpen: boolean,
): boolean {
  return can.playPrototype && !welcomeOpen && wireframeTabPages(pagesOf(tab));
}

export function PrototypeHeaderButton() {
  return (
    <HoverCard
      title="Prototype"
      description="Click through this tab’s screens, as the people using them would."
    >
      <button
        type="button"
        data-tour-id="prototype"
        onClick={() => openPrototype(currentPageIdNow())}
        className={`${CORNER_BTN} ${CORNER_TONE}`}
      >
        <HeaderGlyph>
          <PrototypeIcon />
        </HeaderGlyph>
        <span className="phone:sr-only [[data-compact]_&]:sr-only">Prototype</span>
      </button>
    </HoverCard>
  );
}

// A play triangle in a screen: playing the screens.
function PrototypeIcon() {
  return (
    <Glyph size={13} units={16}>
      <rect x="3.5" y="1.5" width="9" height="13" rx="2" />
      <path d="M6.75 5.6v4.8a.4.4 0 0 0 .6.35l3.6-2.4a.4.4 0 0 0 0-.7l-3.6-2.4a.4.4 0 0 0-.6.35Z" />
    </Glyph>
  );
}
