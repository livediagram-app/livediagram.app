'use client';

// A device's glyph at the title bar's icon size: a phone, a tablet, a laptop, a monitor, a browser
// window or a watch, by the device's class (and the browser its own).
import { Glyph } from '@livedocuments/ui';
import { WIREFRAME_DEVICES, type WireframeDeviceId } from '@livedocuments/document';

export function DeviceGlyph({ device, size = 14 }: { device: WireframeDeviceId; size?: number }) {
  const cls = WIREFRAME_DEVICES[device].deviceClass;
  return (
    <Glyph size={size} units={24}>
      {device === 'browser' ? (
        <>
          <rect x="2.5" y="4" width="19" height="16" rx="2" />
          <path d="M2.5 8.5h19M6 6.25h.01M8.5 6.25h.01" />
        </>
      ) : device === 'desktop' ? (
        <>
          <rect x="2.5" y="3.5" width="19" height="13" rx="1.5" />
          <path d="M9 21h6M12 16.5V21" />
        </>
      ) : cls === 'computer' ? (
        <>
          <rect x="4" y="4.5" width="16" height="11" rx="1.5" />
          <path d="M2 19.5h20M9.5 19.5l.5-1h4l.5 1" />
        </>
      ) : cls === 'tablet' ? (
        <>
          <rect x="4.5" y="2.5" width="15" height="19" rx="2" />
          <path d="M11 18.5h2" />
        </>
      ) : cls === 'watch' ? (
        <>
          <rect x="6" y="6" width="12" height="12" rx="3.5" />
          <path d="M9 6l.6-3.5h4.8L15 6M9 18l.6 3.5h4.8L15 18" />
        </>
      ) : (
        <>
          <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
          <path d="M10.5 5h3" />
        </>
      )}
    </Glyph>
  );
}
