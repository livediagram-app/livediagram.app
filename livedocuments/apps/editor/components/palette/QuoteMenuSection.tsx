'use client';

import {
  QUOTE_LOOKS,
  quoteLookOf,
  quotePortraitOf,
  withQuoteLine,
  withQuoteLook,
  withQuotePortrait,
  type QuoteLook,
  type QuotePortrait,
  type ShapeElement,
} from '@livedocuments/document';
import { Glyph } from '@livedocuments/ui';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { onMouseHover } from '@liveworkspace/workbench/components/primitives/hover-preview';
import { DataMenuGlyph } from '@/components/palette/context-menu-data-rows';
import { BorderGrid, MenuToggleRow } from '@/components/palette/context-menu-rows';
import { SizeButton } from '@/components/palette/palette-controls';
import { MENU_ADD_ROW_BUTTON } from '@liveworkspace/workbench/components/palette/menu-editor-classes';
import type { ElementStyleOps } from '@/lib/element-style-ops';

const LOOK_LABEL: Record<QuoteLook, string> = { card: 'Card Look', plain: 'Plain Look' };
const PORTRAIT_LABEL: Record<QuotePortrait | 'none', string> = {
  none: 'No Portrait',
  initial: 'Initial Portrait',
  photo: 'Photo Portrait',
};

function LookIcon({ look }: { look: QuoteLook }) {
  return (
    <Glyph size={18} units={18}>
      {look === 'card' ? <rect x="2.5" y="3.5" width="13" height="11" rx="2.5" /> : null}
      <path d="M5.5 7.5h1.2M9 7.5h3.5M5.5 10.5h7" />
    </Glyph>
  );
}

function PortraitIcon({ portrait }: { portrait: QuotePortrait | null }) {
  return (
    <Glyph size={18} units={18}>
      {portrait === null ? <path d="M4 14 14 4" /> : null}
      {portrait === 'initial' ? (
        <>
          <circle cx="9" cy="9" r="5.5" />
          <path d="M7.5 12V6h3" />
        </>
      ) : null}
      {portrait === 'photo' ? (
        <>
          <circle cx="9" cy="9" r="5.5" />
          <circle cx="9" cy="7.6" r="1.8" />
          <path d="M5.6 13.1c.8-1.6 2-2.4 3.4-2.4s2.6.8 3.4 2.4" />
        </>
      ) : null}
    </Glyph>
  );
}

// The quote's slots (docs/specs/009-elements/quote.md "Editing the slots"): its look, its name and role lines and its
// portrait, each written through the menu's generic style ops so it is one undo step. A photo needs a picture, so
// picking Photo opens the picture picker (`onOpenPicker`), which writes it; Change Photo and Remove Photo follow.
export function QuoteMenuSection({
  target,
  ops,
  sectionProps,
  onOpenPicker,
  onRemovePhoto,
}: {
  target: ShapeElement;
  ops: ElementStyleOps;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void; flush: boolean };
  onOpenPicker?: (elementId: string) => void;
  onRemovePhoto?: (elementId: string) => void;
}) {
  const look = quoteLookOf(target);
  const portrait = quotePortraitOf(target);
  const portraits: (QuotePortrait | null)[] = [
    null,
    'initial',
    ...(onOpenPicker ? ['photo' as const] : []),
  ];
  return (
    <MenuAccordionSection title="Quote" icon={<DataMenuGlyph />} {...sectionProps('quote')}>
      <div className="px-2 pb-1">
        <BorderGrid label="Look" cols={2}>
          {QUOTE_LOOKS.map((v) => (
            <SizeButton
              key={v}
              active={look === v}
              label={LOOK_LABEL[v]}
              onClick={() => ops.commit((el) => withQuoteLook(el, v), 'QuoteLook')}
              onPointerEnter={onMouseHover(() => ops.preview((el) => withQuoteLook(el, v)))}
              onPointerLeave={onMouseHover(ops.end)}
            >
              <LookIcon look={v} />
            </SizeButton>
          ))}
        </BorderGrid>
      </div>
      <MenuToggleRow
        label="Name"
        checked={!!target.pageTitle}
        onToggle={() =>
          ops.commit((el) => withQuoteLine(el, 'pageTitle', !target.pageTitle), 'QuoteSlots')
        }
      />
      <MenuToggleRow
        label="Role"
        checked={!!target.pageSubtitle}
        onToggle={() =>
          ops.commit((el) => withQuoteLine(el, 'pageSubtitle', !target.pageSubtitle), 'QuoteSlots')
        }
      />
      <div className="px-2 pb-1">
        <BorderGrid label="Portrait" cols={3}>
          {portraits.map((v) => (
            <SizeButton
              key={v ?? 'none'}
              active={portrait === v}
              label={PORTRAIT_LABEL[v ?? 'none']}
              onClick={() => {
                if (v === 'photo') {
                  if (portrait !== 'photo') onOpenPicker?.(target.id);
                  return;
                }
                ops.commit((el) => withQuotePortrait(el, v), 'QuotePortrait');
              }}
              onPointerEnter={
                v === 'photo'
                  ? undefined
                  : onMouseHover(() => ops.preview((el) => withQuotePortrait(el, v)))
              }
              onPointerLeave={v === 'photo' ? undefined : onMouseHover(ops.end)}
            >
              <PortraitIcon portrait={v} />
            </SizeButton>
          ))}
        </BorderGrid>
        {portrait === 'photo' ? (
          <div className="flex gap-1">
            {onOpenPicker ? (
              <button
                type="button"
                className={MENU_ADD_ROW_BUTTON}
                onClick={() => onOpenPicker(target.id)}
              >
                Change Photo
              </button>
            ) : null}
            {onRemovePhoto ? (
              <button
                type="button"
                className={MENU_ADD_ROW_BUTTON}
                onClick={() => onRemovePhoto(target.id)}
              >
                Remove Photo
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </MenuAccordionSection>
  );
}
