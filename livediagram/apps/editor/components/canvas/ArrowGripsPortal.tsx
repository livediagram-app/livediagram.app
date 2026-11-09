import type { ReactNode } from 'react';
import { ArrowGripsPortal as GripsPortal } from '@liveworkspace/workbench/components/canvas/SelectionGripsLayer';
import { useInsertShift } from '@/hooks/canvas/useInsertShift';

// An arrow's grips in the grips layer (@liveworkspace/workbench's SelectionGripsLayer), shifted with the arrow while
// it stands aside for the insert-between preview (docs/specs/021-event-storming/event-storming.md). Only a shown
// grip set subscribes to the shift, so the arrows without grips never render for it.
export function ArrowGripsPortal({ arrowId, children }: { arrowId: string; children: ReactNode }) {
  const shiftX = useInsertShift().xFor(arrowId);
  return (
    <GripsPortal arrowId={arrowId} shiftX={shiftX}>
      {children}
    </GripsPortal>
  );
}
