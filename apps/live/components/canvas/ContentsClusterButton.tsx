'use client';

import { lucideListOrdered } from '@livediagram/icons/lucide';
import { HoverCard, lucideGlyph } from '@livediagram/ui';
import { CLUSTER_CONTROL_REST } from '@/components/canvas/cluster-strip';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { ClusterStrip } from './ClusterPopoverButton';

const ContentsIcon = lucideGlyph(lucideListOrdered, 16);

// Contents in the bottom-right cluster, in Illustrate mode (docs/specs/007-editor/
// illustrate-pages.md "Contents"): every page of the tab one press away, for every role. Named
// beside its icon on a desktop, the cluster's own height; its icon alone on a phone.
export function ContentsClusterButton({
  popoverOpen,
  onTogglePopover,
}: {
  popoverOpen: boolean;
  onTogglePopover: (button: HTMLElement) => void;
}) {
  const mobile = useIsMobileViewport();
  const button = (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => onTogglePopover(e.currentTarget)}
      aria-label="Contents"
      aria-expanded={popoverOpen}
      className={`flex h-11 items-center justify-center gap-2 text-sm font-medium transition ${
        mobile ? 'w-11' : 'px-3.5'
      } ${
        popoverOpen
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : CLUSTER_CONTROL_REST
      }`}
    >
      <ContentsIcon />
      {mobile ? null : <span aria-hidden>Contents</span>}
    </button>
  );
  return (
    <ClusterStrip dataTourId="contents">
      {popoverOpen ? (
        button
      ) : (
        <HoverCard
          title="Contents"
          description="Every page of this tab: jump to one, or add a page."
        >
          {button}
        </HoverCard>
      )}
    </ClusterStrip>
  );
}
