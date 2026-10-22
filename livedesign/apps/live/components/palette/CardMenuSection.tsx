'use client';

import type { ReactNode } from 'react';
import {
  CARD_MEDIA,
  cardMediaOf,
  withCardHeader,
  withCardLine,
  withCardMedia,
  type CardMedia,
  type ShapeElement,
} from '@livedesign/document';
import { Glyph } from '@livedesign/ui';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import { DataMenuGlyph } from '@/components/palette/context-menu-data-rows';
import { BorderGrid, MenuToggleRow } from '@/components/palette/context-menu-rows';
import { SizeButton } from '@/components/palette/palette-controls';
import { onMouseHover } from '@/components/primitives/hover-preview';
import type { ElementStyleOps } from '@/lib/element-style-ops';

const MEDIA_LABEL: Record<CardMedia | 'none', string> = {
  none: 'No Media',
  badge: 'Badge Media',
  tile: 'Tile Media',
  initial: 'Initial Media',
};

function MediaIcon({ media }: { media: CardMedia | null }) {
  return (
    <Glyph size={18} units={18}>
      {media === null ? <path d="M4 14 14 4" /> : null}
      {media === 'badge' ? (
        <circle cx="9" cy="9" r="5.5" fill="currentColor" stroke="none" />
      ) : null}
      {media === 'tile' ? (
        <rect x="3.5" y="3.5" width="11" height="11" rx="3" strokeWidth="1.5" />
      ) : null}
      {media === 'initial' ? (
        <>
          <circle cx="9" cy="9" r="5.5" />
          <path d="M7 12V6h3" />
        </>
      ) : null}
    </Glyph>
  );
}

// The card's slots (docs/specs/009-elements/card.md "Editing the slots"): the header band, the title and meta line,
// and the media, written through the menu's generic style ops so each is one undo step. Tags have their own rows
// section (WebRowsMenuSection), like every other row-carrying web component.
export function CardMenuSection({
  target,
  ops,
  sectionProps,
  tagColours,
}: {
  target: ShapeElement;
  ops: ElementStyleOps;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void; flush: boolean };
  // The Tag Colours block (docs/specs/009-elements/tag-colours.md), last in the section; absent read-only.
  tagColours?: ReactNode;
}) {
  const media = cardMediaOf(target);
  const options: (CardMedia | null)[] = [null, ...CARD_MEDIA];
  return (
    <MenuAccordionSection title="Card" icon={<DataMenuGlyph />} {...sectionProps('card')}>
      <MenuToggleRow
        label="Header Band"
        checked={target.cardHeader === true}
        onToggle={() =>
          ops.commit((el) => withCardHeader(el, target.cardHeader !== true), 'CardSlots')
        }
      />
      <MenuToggleRow
        label="Title"
        checked={!!target.pageTitle}
        onToggle={() =>
          ops.commit((el) => withCardLine(el, 'pageTitle', !target.pageTitle), 'CardSlots')
        }
      />
      <MenuToggleRow
        label="Meta Line"
        checked={!!target.pageSubtitle}
        onToggle={() =>
          ops.commit((el) => withCardLine(el, 'pageSubtitle', !target.pageSubtitle), 'CardSlots')
        }
      />
      <div className="px-2 pb-1">
        <BorderGrid label="Media" cols={4}>
          {options.map((v) => (
            <SizeButton
              key={v ?? 'none'}
              active={media === v}
              label={MEDIA_LABEL[v ?? 'none']}
              onClick={() => ops.commit((el) => withCardMedia(el, v), 'CardSlots')}
              onPointerEnter={onMouseHover(() => ops.preview((el) => withCardMedia(el, v)))}
              onPointerLeave={onMouseHover(ops.end)}
            >
              <MediaIcon media={v} />
            </SizeButton>
          ))}
        </BorderGrid>
      </div>
      {tagColours}
    </MenuAccordionSection>
  );
}
