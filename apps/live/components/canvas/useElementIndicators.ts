// An element's indicators (docs/specs/008-canvas/element-indicators.md), worked out for
// BoxedElementView: which indicators it carries (link, note, open action, unresolved comments, a
// mind root's commands), what each opens, and where the cluster and the content go. Its own hook so
// the element view only wires the result in.
import {
  activeCommentCount,
  isOpenAction,
  type BoxedElement,
  type TextAlignX,
  type TextAlignY,
  type TextSize,
} from '@livediagram/document';
import { describeLink } from '@/lib/link-label';
import { colorForKey, initialsOf } from '@/lib/identity';
import { useCommentBadges } from '@/components/canvas/CommentBadgesContext';
import { useMindOutlineBadge } from '@/components/canvas/MindOutlineContext';
import { inlineIconGap, inlineIconMetrics } from '@/components/canvas/shape-inline-icon-layout';
import { buildIndicatorItems, type IndicatorItem } from './indicator-items';
import { useIndicatorLayout, type IndicatorLayout } from './useIndicatorLayout';
import type { BoxedElementViewProps } from './BoxedElementView.types';

type Handlers = Pick<
  BoxedElementViewProps,
  'onFollowLink' | 'onOpenComments' | 'onOpenAction' | 'onOpenNote' | 'tabSummaries'
>;

/** The element's indicator items, from its state and the view's handlers. Pure. */
export function elementIndicatorItems(
  element: BoxedElement,
  handlers: Handlers,
  mindRoot?: { editOutline: () => void; tidy: () => void },
  // False where the reader has no comments to open (a viewer in an embed, docs/specs/013-workspace/embeds.md; a
  // Community visitor, docs/specs/025-community/community.md): no comment indicator.
  showComments = true,
): IndicatorItem[] {
  // A margin note shows its count and action on its own face.
  if (element.type === 'annotation' && element.articleNote) return [];
  const { onFollowLink, onOpenComments, onOpenAction, onOpenNote, tabSummaries } = handlers;
  const shape = element.type === 'shape' ? element.shape : undefined;
  // A comment pin and an action panel show theirs on their face; a link card IS its link; an
  // annotation's marker is its note. A done action stops showing.
  const link =
    element.type !== 'link-card' &&
    element.link &&
    (element.link.kind === 'tab' || element.link.kind === 'document' || element.link.kind === 'url')
      ? element.link
      : undefined;
  const assignee =
    shape !== 'action-card' && isOpenAction(element.action) ? element.action?.assignee : undefined;
  const assigneeName = assignee?.name?.trim() || 'a teammate';
  return buildIndicatorItems({
    outline: mindRoot?.editOutline,
    tidy: mindRoot?.tidy,
    link: link
      ? { onFollow: () => onFollowLink(link), destination: describeLink(link, tabSummaries) }
      : undefined,
    note:
      element.note && onOpenNote && element.type !== 'annotation'
        ? () => onOpenNote(element.id)
        : undefined,
    action: assignee
      ? {
          onOpen: () => onOpenAction(element.id),
          assigneeName,
          initials: initialsOf(assigneeName),
          color: colorForKey(assignee.userId ?? assignee.memberId ?? assigneeName),
        }
      : undefined,
    comments: {
      count: shape === 'comment-pin' || !showComments ? 0 : activeCommentCount(element.commentThread),
      onOpen: () => onOpenComments(element.id),
    },
  });
}

export function useElementIndicators(
  element: BoxedElement,
  handlers: Handlers,
  label: {
    text: string;
    textSize: TextSize;
    padding: number;
    alignX: TextAlignX;
    alignY: TextAlignY;
    // The element has an inline icon beside or above its label.
    inlineIcon: boolean;
  },
  // The element's drawn corner radius.
  cornerPx: number,
): { items: IndicatorItem[]; layout: IndicatorLayout | null; cornerPx: number } {
  const items = elementIndicatorItems(
    element,
    handlers,
    useMindOutlineBadge(element.id),
    useCommentBadges(),
  );
  const shape = element.type === 'shape' ? element.shape : undefined;
  // A circle or a pill is fully round however its corner preset reads.
  const indicatorCornerPx = shape === 'circle' || shape === 'stadium' ? Infinity : cornerPx;
  const metrics = label.inlineIcon ? inlineIconMetrics(element, label.text, label.textSize) : null;
  const position = (element.type === 'shape' && element.iconPosition) || 'left';
  const layout = useIndicatorLayout(element, indicatorCornerPx, items, {
    label: label.text,
    textSize: label.textSize,
    padding: label.padding,
    alignX: label.alignX,
    alignY: label.alignY,
    ...(metrics
      ? {
          fontPx: metrics.fontSize,
          icon: {
            size: metrics.iconSize,
            position,
            gap: inlineIconGap(metrics.iconSize, position === 'left' || position === 'right'),
          },
        }
      : {}),
  });
  return { items, layout, cornerPx: indicatorCornerPx };
}
