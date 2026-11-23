'use client';

// Connect a File on the tab bar, right of Add tab (liveworkspace/docs/specs/004-index/connected-tabs.md "From the tab
// bar"): the liveworkspace logo, drawn small, in a button of Add tab's size. Its prism follows the bar's light or dark
// look and turns while pointed at, as the platform's wordmark does. It counts nothing itself: each app counts its press.
import { useState } from 'react';
import { WorkspaceMark } from '@liveworkspace/brand';
import { Tooltip } from '@liveworkspace/ui';
import { TAB_CONNECT_CLASS } from './tab-shape';

export const CONNECT_TAB_LABEL = 'Connect a File';

export function ConnectTabButton({ onClick }: { onClick: () => void }) {
  const [spinning, setSpinning] = useState(false);
  return (
    <Tooltip label={CONNECT_TAB_LABEL}>
      <button
        type="button"
        onClick={onClick}
        aria-label={CONNECT_TAB_LABEL}
        aria-haspopup="dialog"
        data-tour-id="connect-tab"
        onPointerEnter={(e) => setSpinning(e.pointerType !== 'touch')}
        onPointerLeave={() => setSpinning(false)}
        className={TAB_CONNECT_CLASS}
      >
        <WorkspaceMark className="size-4" spinning={spinning} />
      </button>
    </Tooltip>
  );
}
