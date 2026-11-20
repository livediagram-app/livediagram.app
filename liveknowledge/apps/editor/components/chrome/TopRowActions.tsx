'use client';

// Share (or Make a Copy, for a visitor) and the account button, at the right end of the top row in every view
// (docs/specs/030-knowledgebase/page-surface.md "The footer"). Drawn once by the editor and placed in the slot of the
// row on top (lib/page-surface/top-row-slot.ts), so the account's menu and the Share legend keep their state as the
// view changes. The buttons are the ones every liveworkspace editor shows (@liveworkspace/workbench).
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Glyph, HoverCard } from '@liveknowledge/ui';
import { AuthControls } from '@liveworkspace/workbench/components/chrome/AuthControls';
import {
  CORNER_BTN,
  CORNER_TONE,
  HeaderShareIcon,
} from '@liveworkspace/workbench/components/chrome/EditorCornerActions';
import { ShareVisibilityButton } from '@liveworkspace/workbench/components/chrome/ShareVisibilityButton';
import {
  shareStateOf,
  shareStatesOf,
  type ItemVisibility,
  type VisibilityActions,
} from '@liveworkspace/workbench/components/chrome/share-states';
import { useTopRowSlot } from '@/lib/page-surface/top-row-slot';

export type TopRowActionsProps = {
  // Where the knowledgebase's approval stands, first (an `<ApprovalBadge corner />`).
  approval?: ReactNode;
  showShare: boolean;
  shareable: boolean;
  visibility: ItemVisibility;
  onOpenShare: () => void;
  onTakeOffline?: (() => void) | undefined;
  visibilityActions?: VisibilityActions | undefined;
  // A visitor's Make a Copy, in Share's place.
  onMakeCopy?: (() => void) | undefined;
  copying: boolean;
  onOpenAccount: () => void;
};

export function TopRowActions(props: TopRowActionsProps) {
  const slot = useTopRowSlot();
  if (!slot) return null;
  const { visibility, onOpenShare } = props;
  return createPortal(
    <>
      {props.approval ?? null}
      {props.onMakeCopy ? (
        <HoverCard
          title="Make a Copy"
          description="Duplicate this knowledgebase into your own files."
        >
          <button
            type="button"
            onClick={props.onMakeCopy}
            disabled={props.copying}
            className={`${CORNER_BTN} ${CORNER_TONE}`}
          >
            <Glyph size={14} units={16}>
              <rect x="5" y="5" width="8" height="8.5" rx="1.5" />
              <path d="M3 11V3.5A1.5 1.5 0 0 1 4.5 2H10" />
            </Glyph>
            <span className="phone:sr-only">{props.copying ? 'Copying' : 'Copy'}</span>
          </button>
        </HoverCard>
      ) : null}
      {props.showShare ? (
        <ShareVisibilityButton
          state={shareStateOf(props.shareable, visibility)}
          states={shareStatesOf(props.shareable, visibility)}
          onOpenShare={onOpenShare}
          actions={{
            shared: onOpenShare,
            ...(props.onTakeOffline ? { offline: props.onTakeOffline } : {}),
            ...props.visibilityActions,
          }}
          className={`${CORNER_BTN} hover:bg-slate-100 dark:hover:bg-slate-800`}
        >
          <HeaderShareIcon />
          <span className="phone:sr-only">Share</span>
        </ShareVisibilityButton>
      ) : null}
      <AuthControls onOpenAccount={props.onOpenAccount} />
    </>,
    slot,
  );
}
