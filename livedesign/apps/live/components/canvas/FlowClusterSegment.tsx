'use client';

import { lucideWorkflow } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livedesign/ui';
import { ClusterPopoverSegment } from '@liveworkspace/workbench/components/canvas/ClusterPopoverButton';
import { toggleFlowView, useFlowView } from '@/lib/flow-view-store';

const FlowIcon = lucideGlyph(lucideWorkflow, 16);

// The Flow view's switch in the bottom-right cluster (docs/specs/007-editor/wireframe-pages.md "Flow view"): joined
// after Inspect in the pages strip while the tab is a wireframe tab, for every role and on a phone. Pressed while the
// canvas draws an arrow from each linked element to its screen.
export function FlowClusterSegment() {
  const on = useFlowView();
  return (
    <ClusterPopoverSegment
      toggle
      label="Flow View"
      name="Flow"
      hoverTitle="Flow View"
      hoverDescription="Draw an arrow from each linked element to the screen it goes to."
      icon={<FlowIcon />}
      dataTourId="flow-view-button"
      popoverOpen={on}
      onTogglePopover={toggleFlowView}
    />
  );
}
