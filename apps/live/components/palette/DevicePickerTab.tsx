import type { ShapeKind } from '@livediagram/diagram';
import { IconButton } from '@/components/palette/palette-controls';

type DevicePickerTabProps = {
  addShape: (kind: ShapeKind) => void;
  pendingShapeKind: ShapeKind | null;
};

// Wireframing device-frame primitives (browser / monitor / laptop / phone /
// tablet / smartwatch / web screen) offered in the command palette's Devices
// tab. Each IconButton drops the frame shape (or drag-arms it). Split out of
// CommandPalette.
export function DevicePickerTab({ addShape, pendingShapeKind }: DevicePickerTabProps) {
  return (
    <>
      {/* Wireframing primitives. Each renders as the device's
            silhouette so the user can drop it as a container and
            arrange interface elements inside. See spec/09 "Devices".
            Six-column grid (like Icons / Shapes) so all six device tiles
            sit on one full row instead of flex-wrap pushing the smartwatch
            onto its own line with a gap on the right. */}
      <div className="grid grid-cols-3 justify-items-center gap-1 overflow-x-hidden">
        <IconButton
          label="Add web browser"
          caption="Browser"
          description="Browser window. Wireframe a web page or a web-app screen."
          onClick={() => addShape('browser')}
          dragKind="browser"
          filled
          active={pendingShapeKind === 'browser'}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="2" y="3" width="14" height="12" rx="1.5" />
            <path d="M2 7 L16 7" />
          </svg>
        </IconButton>
        <IconButton
          label="Add computer monitor"
          caption="Monitor"
          description="Desktop monitor with stand. Wireframe a desktop app."
          onClick={() => addShape('monitor')}
          dragKind="monitor"
          filled
          active={pendingShapeKind === 'monitor'}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="2" y="2.5" width="14" height="9" rx="1" />
            <path d="M6 15.5 L12 15.5" />
            <path d="M9 11.5 L9 15.5" />
          </svg>
        </IconButton>
        <IconButton
          label="Add laptop"
          description="Laptop. Screen plus keyboard base."
          onClick={() => addShape('laptop')}
          dragKind="laptop"
          filled
          active={pendingShapeKind === 'laptop'}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="3.5" y="3" width="11" height="8" rx="1" />
            <path d="M1.5 14 L16.5 14 L15 11 L3 11 Z" />
          </svg>
        </IconButton>
        <IconButton
          label="Add phone"
          description="Phone. Wireframe a mobile screen."
          onClick={() => addShape('phone')}
          dragKind="phone"
          filled
          active={pendingShapeKind === 'phone'}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="5.5" y="1.5" width="7" height="15" rx="1.6" />
          </svg>
        </IconButton>
        <IconButton
          label="Add tablet"
          description="Tablet. Larger than a phone, smaller than a laptop screen."
          onClick={() => addShape('tablet')}
          dragKind="tablet"
          filled
          active={pendingShapeKind === 'tablet'}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="3" y="2" width="12" height="14" rx="1.2" />
          </svg>
        </IconButton>
        <IconButton
          label="Add smartwatch"
          caption="Watch"
          description="Smartwatch. A wrist-device frame for watch-app wireframes."
          onClick={() => addShape('smartwatch')}
          dragKind="smartwatch"
          filled
          active={pendingShapeKind === 'smartwatch'}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="5.5" y="4" width="7" height="10" rx="2.2" />
            <path d="M7 4 V1.8 M11 4 V1.8 M7 14 V16.2 M11 14 V16.2 M12.5 8 H14" />
          </svg>
        </IconButton>
      </div>
    </>
  );
}
