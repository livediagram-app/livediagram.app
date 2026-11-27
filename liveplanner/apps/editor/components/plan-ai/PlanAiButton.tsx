'use client';

// The AI button (docs/specs/026-plan/plan-ai.md "The button"): in the bottom-right cluster, left of the Plan strip's
// Trash and Card Types, on a Board, Sheet, Form or Dashboard tab, for everyone who can open the plan (a guest is asked
// to sign in, a Viewer asks and changes nothing). It opens Plan AI's panel above it. Named "AI" beside its sparkle on a
// wide desktop, as the strip's buttons are.
import { SparkleIcon } from '@liveworkspace/ui';
import {
  ClusterPopoverSegment,
  ClusterStrip,
} from '@liveworkspace/workbench/components/canvas/ClusterPopoverButton';

export function PlanAiButton({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: (button: HTMLElement) => void;
}) {
  return (
    <ClusterStrip>
      <ClusterPopoverSegment
        label="Open AI"
        hoverTitle="AI"
        hoverDescription="Ask about this tab, or tell AI what to change on it."
        icon={<SparkleIcon size={18} />}
        name="AI"
        dataTourId="plan-ai"
        popoverOpen={open}
        onTogglePopover={onToggle}
      />
    </ClusterStrip>
  );
}
