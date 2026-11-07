'use client';

import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { isTypingTarget } from '@liveworkspace/workbench/lib/typing-target';
import dynamic from 'next/dynamic';
import { Glyph, HoverCard, lucideGlyph } from '@livehuddle/ui';
import {
  lucideCircleDot,
  lucideHand,
  lucideMessageCircle,
  lucidePartyPopper,
  lucideScissors,
  lucideUser,
} from '@liveworkspace/icons/lucide';
import { TOOLBAR_TRIGGER_TONE } from '@liveworkspace/workbench/components/palette/PaletteDropdown';
import {
  StripPopover,
  useStripPopover,
} from '@liveworkspace/workbench/components/palette/ToolbarStripPopover';
import { useBarLabels } from '@liveworkspace/workbench/components/palette/useBarLabels';
import { useStripCrowded } from '@liveworkspace/workbench/components/palette/useStripCrowded';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { useUiScale } from '@liveworkspace/workbench/components/providers/ui-scale';
import {
  STRIP_CONTROL_GLYPH,
  STRIP_CONTROL_LABEL,
  STRIP_CONTROL_NAMED,
  STRIP_RAIL_SCROLL,
  STRIP_TINT_BUTTON,
  STRIP_TINT_OPEN,
} from '@/components/chrome/toolbar-surface';
import { AVATAR_PALETTE_CATEGORIES, type AvatarPaletteCategoryId } from '@/lib/avatar-palette';
import { CategoryBarButtons, useCategoryBar, type BarCategory } from './CategoryBar';
import { CARD_CLASS, CardWidth, StripRow, stripRootLayout } from './ToolbarPalette';
import { Divider } from './strip-rail-items';
import { FlyoutHeader } from './CategoryFlyout';
import { FLYOUT_FOOTER_CLASS } from './category-flyout-items';
import {
  AVATAR_FLYOUT_WIDTH,
  AVATAR_FLYOUT_WIDTH_CLASS,
  PREVIEW_GAP_PX,
  PREVIEW_PX,
  previewFits,
  type AvatarPaletteActions,
} from './avatar-palette-widths';
import { loadToolPanels } from '@/lib/editor-deferred-code';

// The flyouts' bodies and the message popover load with the tool panels, on demand (fetched once the editor is
// idle, lib/editor-deferred-code.ts), so the strip itself costs the first load only its buttons.
const AvatarPaletteFlyout = dynamic(() => loadToolPanels().then((m) => m.AvatarPaletteFlyout), {
  ssr: false,
});
const AvatarMessagePopover = dynamic(() => loadToolPanels().then((m) => m.AvatarMessagePopover), {
  ssr: false,
});
const AvatarPalettePreview = dynamic(() => loadToolPanels().then((m) => m.AvatarPalettePreview), {
  ssr: false,
});

// The avatar palette (docs/specs/008-canvas/avatar-mode.md "The avatar palette"): while you walk, the palette strip
// dresses and moves your character instead of building the board. Same place, same parts as the building strip
// (ToolbarPalette): an Editor's Edit | Walk toggle first (its way back to building), then the look's categories on the
// left and the actions on the right, each a category-bar button opening its flyout (AvatarPaletteFlyouts), then Say
// where Search sits. A Participant and a Viewer never leave, so theirs has no toggle. The call's buttons are not the
// strip's: they sit in the Call dock, bottom centre (CallDock; owner 2026-11-07).

const SAY_SELECTOR = '[data-avatar-say], [data-avatar-say-button]';

// A T-shirt, for Clothes (lucide's shirt outline, which the icon set does not carry).
function ShirtIcon() {
  return (
    <Glyph size={18} units={24}>
      <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
    </Glyph>
  );
}

const ICONS: Record<AvatarPaletteCategoryId, () => ReactNode> = {
  character: lucideGlyph(lucideUser, 18),
  clothes: ShirtIcon,
  hair: lucideGlyph(lucideScissors, 18),
  status: lucideGlyph(lucideCircleDot, 18),
  behaviour: lucideGlyph(lucideHand, 18),
  reactions: lucideGlyph(lucidePartyPopper, 18),
};
const SayIcon = lucideGlyph(lucideMessageCircle, 18);

// The bar's categories, built once: the look (band 0) and the actions (band 1).
const CATEGORIES: readonly (BarCategory & { id: AvatarPaletteCategoryId })[] =
  AVATAR_PALETTE_CATEGORIES.map((c) => {
    const Icon = ICONS[c.id];
    return {
      id: c.id,
      label: c.label,
      description: c.description,
      group: c.group,
      icon: <Icon />,
      tiles: null,
      content: null,
      width: AVATAR_FLYOUT_WIDTH[c.id],
    };
  });
const LOOK = CATEGORIES.filter((c) => c.group === 0);
const ACTIONS = CATEGORIES.filter((c) => c.group === 1);

export type AvatarPaletteProps = AvatarPaletteActions & {
  // The chrome is away (an embed, the welcome flow): hidden rather than unmounted.
  hidden?: boolean;
  // The phone's row: the menu card beside the strip (ToolbarPalette's `leading`).
  leading?: ReactNode;
  // An Editor's Edit | Walk toggle (EditWalkToggle), first on the strip, Walk on: its way back to building. A
  // Participant and a Viewer always walk, so they get none (docs/specs/013-workspace/share-roles.md "Always walking").
  editWalk?: ReactNode;
  // Say something (absent for someone who may not speak, who gets no Say button). Answers whether it went.
  onSendMessage?: ((text: string) => boolean) | undefined;
  speechCooling?: boolean;
};

export function AvatarPalette(props: AvatarPaletteProps) {
  const { hidden, leading, onSendMessage } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const leadingRef = useRef<HTMLDivElement>(null);
  // The bar's hover intent, pinning and flyout popover, as the building strip's category bar has them.
  const bar = useCategoryBar(rootRef);
  const say = useStripPopover(rootRef, SAY_SELECTOR);
  const isMobile = useIsMobileViewport();
  const scale = useUiScale('toolbar');
  const swipe = leading !== undefined;
  // Named while the strip has room (useBarLabels); on a phone, where the look and the actions swipe, always (owner,
  // 2026-11-07: "it scrolls so its not an issue that they don't all fit on screen"), Say with them.
  const fittedLabels = useBarLabels(cardRef, {
    enabled: !isMobile,
    // The toggle comes and goes with an Editor's role preview, so it is part of the shape measured too.
    categoriesKey: `${CATEGORIES.map((c) => c.label).join('|')}#${props.editWalk ? 'toggle' : ''}`,
    scale,
  });
  const barLabels = fittedLabels || swipe;
  const crowded = useStripCrowded(cardRef, leading == null);
  const open = CATEGORIES.find((c) => c.id === bar.openId) ?? null;
  // The preview card: a desktop's, while a flyout is open, where the window has room right of it. Measured when the
  // flyout opens or moves and on a resize, never per frame.
  const [previewRoom, setPreviewRoom] = useState(false);
  const flyoutRight = bar.popover.right;
  const previewWanted = open !== null && !isMobile;
  useLayoutEffect(() => {
    if (!previewWanted) return;
    const measure = () => {
      const root = rootRef.current?.getBoundingClientRect();
      setPreviewRoom(!!root && previewFits(root.right, flyoutRight, window.innerWidth));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [previewWanted, flyoutRight]);
  // Escape closes the open flyout or Say, and nothing else: caught ahead of the editor's shortcuts, where Escape
  // would leave Avatar mode altogether. Typing elsewhere keeps its own Escape; Say's message field is caught here too,
  // since closing the popover under the key unmounted the field before its own Cancel ran and the editor then heard
  // the key and left the mode.
  const anyOpen = open !== null || say.open;
  const onEscape = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    const inSay = e.target instanceof Element && e.target.closest('[data-avatar-say]') !== null;
    if (isTypingTarget(e.target) && !inSay) return;
    e.preventDefault();
    e.stopPropagation();
    if (open) bar.close(true);
    if (say.open) {
      say.setOpen(false);
      // Back to Say, as the strip's popovers hand focus back to their button.
      if (inSay)
        rootRef.current
          ?.querySelector<HTMLElement>('[data-avatar-say-button]')
          ?.focus({ preventScroll: true });
    }
  });
  useEffect(() => {
    if (!anyOpen) return;
    const onKey = (e: KeyboardEvent) => onEscape(e);
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [anyOpen]);

  const sayButton = onSendMessage ? (
    <HoverCard
      disabled={say.open}
      title="Say Something"
      description={
        isMobile
          ? 'Type a message that floats above your head.'
          : 'Type a message that floats above your head. Shortcut: Enter.'
      }
    >
      <button
        type="button"
        data-avatar-say-button=""
        data-tour-id="avatar-message"
        aria-label="Say something"
        aria-keyshortcuts={isMobile ? undefined : 'Enter'}
        aria-expanded={say.open}
        onClick={(e) =>
          say.open ? say.setOpen(false) : say.openFrom(e.currentTarget, 'right', 320)
        }
        // The tinted strip button the Call dock's buttons share (toolbar-surface).
        className={`${STRIP_TINT_BUTTON} ${barLabels ? STRIP_CONTROL_NAMED : STRIP_CONTROL_GLYPH} ${
          say.open ? STRIP_TINT_OPEN : TOOLBAR_TRIGGER_TONE
        }`}
      >
        <span aria-hidden className="flex h-[18px] w-[18px] items-center justify-center">
          <SayIcon />
        </span>
        {barLabels ? <span className={STRIP_CONTROL_LABEL}>Say</span> : null}
      </button>
    </HoverCard>
  ) : null;

  const groups = (
    <>
      <div data-tour-id="avatar-character" className="flex">
        <CategoryBarButtons bar={bar} categories={LOOK} labels={barLabels} ariaLabel="Your Look" />
      </div>
      <Divider />
      <div data-tour-id="avatar-actions" className="flex">
        <CategoryBarButtons bar={bar} categories={ACTIONS} labels={barLabels} ariaLabel="Actions" />
      </div>
    </>
  );

  return (
    <div
      ref={rootRef}
      data-avatar-palette=""
      // Measured as the strip by what clears it (useStripCrowdsCorners, the mode banner), as the building strip is.
      data-toolbar-palette=""
      data-region="palette"
      data-panel-translucent=""
      {...stripRootLayout({ scale, crowded, popoverOpen: bar.popover.open || say.open, hidden })}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <StripRow leading={leading} leadingRef={leadingRef}>
        <CardWidth swipe={swipe}>
          <div
            ref={cardRef}
            data-tour-id="palette"
            data-floating-panel=""
            data-split-chrome=""
            className={`${
              swipe ? `${CARD_CLASS} min-w-0 [&>:not([data-strip-rail])]:shrink-0` : CARD_CLASS
            }`}
          >
            {/* An Editor's Edit | Walk toggle, first, so it stays put as the building strip gives way to this one
                (docs/specs/008-canvas/avatar-mode.md "The Edit | Walk toggle"). */}
            {props.editWalk ? (
              <>
                {props.editWalk}
                <Divider />
              </>
            ) : null}
            {/* On a phone the look and the actions swipe together; Say stays put. */}
            {swipe ? (
              <div data-strip-rail="" className={`flex min-w-0 items-center ${STRIP_RAIL_SCROLL}`}>
                {groups}
              </div>
            ) : (
              groups
            )}
            {sayButton ? (
              <>
                <Divider />
                {sayButton}
              </>
            ) : null}
          </div>
        </CardWidth>
      </StripRow>
      {open ? (
        <StripPopover
          right={bar.popover.right}
          isMobile={isMobile}
          scale={scale}
          name={open.label}
          dataAttr="data-category-flyout"
          widthClass={AVATAR_FLYOUT_WIDTH_CLASS[open.id]}
          glide
          bare
        >
          <div
            onPointerEnter={(e) => {
              if (e.pointerType === 'mouse') bar.hoverFlyout();
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === 'mouse') bar.leave();
            }}
          >
            <AvatarPaletteFlyout
              key={open.id}
              category={open}
              icon={open.icon}
              actions={props}
              mobile={isMobile}
              focusFirst={bar.viaKeyboard}
            />
          </div>
        </StripPopover>
      ) : null}
      {open && previewWanted && previewRoom ? (
        // Its own card, 8 px right of the flyout and level with its top. A press on it is not outside the flyout
        // (`data-category-flyout-side`, the bar's own selector), and the pointer crossing onto it keeps a flyout opened
        // by hover open, as the flyout itself does.
        <StripPopover
          right={flyoutRight - PREVIEW_GAP_PX - PREVIEW_PX}
          isMobile={false}
          scale={scale}
          dataAttr="data-category-flyout-side"
          widthClass="w-[13rem]"
          glide
          bare
        >
          <div
            data-avatar-preview=""
            onPointerEnter={(e) => {
              if (e.pointerType === 'mouse') bar.hoverFlyout();
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === 'mouse') bar.leave();
            }}
          >
            <AvatarPalettePreview config={props.config} shirt={props.shirt} status={props.status} />
          </div>
        </StripPopover>
      ) : null}
      {say.open && onSendMessage ? (
        <StripPopover
          right={say.right}
          isMobile={isMobile}
          scale={scale}
          dataAttr="data-avatar-say"
          name="Say Something"
          widthClass="w-[20rem]"
          bare
        >
          {/* Built like the flyouts beside it: their header, the body at their padding, the actions in their footer
              bar (docs/specs/008-canvas/avatar-mode.md "The message popover"). */}
          <AvatarMessagePopover
            header={
              <FlyoutHeader
                icon={<SayIcon />}
                title="Say Something"
                tagline="Words that float up above your head."
              />
            }
            bodyClassName="p-3"
            footerClassName={`${FLYOUT_FOOTER_CLASS} py-2.5`}
            coolingDown={!!props.speechCooling}
            onSend={(text) => {
              const sent = onSendMessage(text);
              // Closed, so the bubble is seen rising.
              if (sent) say.setOpen(false);
              return sent;
            }}
            onCancel={() => say.setOpen(false)}
          />
        </StripPopover>
      ) : null}
    </div>
  );
}
