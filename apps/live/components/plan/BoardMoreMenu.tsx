'use client';

// A board's ⋯ menu (docs/specs/026-plan/plan-board.md "The board set-up"): in its header, left of the settings cog,
// the board's actions as icon-left rows; for now **Add to Slides**, which puts the board in the document's slide
// deck. Shown only when it has something to offer.
import { useState } from 'react';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { MenuActionRow, PortalMenu } from '@/components/primitives/PortalMenu';
import { SlideDeckIcon } from '@/components/palette/palette-icons';
import { usePlan } from './PlanContext';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function BoardMoreMenu({ boardId, title }: { boardId: string; title: string }) {
  const plan = usePlan();
  const [open, setOpen] = useState(false);
  // Held in state so the menu anchors on its first render.
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const addSlide = plan?.addBoardSlide;
  if (!addSlide) return null;
  return (
    <span className="flex" onPointerDown={stop}>
      <EllipsisTriggerButton
        ref={setButton}
        size="lg"
        label={`More for ${title || 'this board'}`}
        expanded={open}
        onClick={() => setOpen((v) => !v)}
      />
      {open ? (
        <PortalMenu anchor={button} placement="below" onClose={() => setOpen(false)}>
          <MenuActionRow
            plain
            label="Add to Slides"
            icon={<SlideDeckIcon />}
            onClick={() => {
              setOpen(false);
              addSlide(boardId);
              plan?.announce('Board added to the slides');
            }}
          />
        </PortalMenu>
      ) : null}
    </span>
  );
}
