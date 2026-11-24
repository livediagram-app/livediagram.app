// @vitest-environment jsdom
// The corner card's actions as the phone's Apps drawer reads them (liveworkspace/docs/specs/011-workbench/
// phone-apps-drawer.md "Performance"): the Apps button re-renders only when what the drawer shows changes, never for a
// new closure on an editor's render; the open drawer follows every publish.
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  publishPhoneApps,
  snapshotKey,
  usePhoneApps,
  usePublishPhoneApps,
  type PhoneAppsSnapshot,
} from './phone-apps-store';

const snap = (over: Partial<PhoneAppsSnapshot> = {}): PhoneAppsSnapshot => ({
  itemName: 'Plan',
  shareWords: 'Private',
  showShare: true,
  onOpenShare: () => {},
  copying: false,
  hasCall: false,
  offline: false,
  ...over,
});

afterEach(() => act(() => publishPhoneApps(null)));

function counter(live: boolean) {
  const seen: (PhoneAppsSnapshot | null)[] = [];
  function Reader() {
    seen.push(usePhoneApps({ live }));
    return null;
  }
  render(<Reader />);
  return seen;
}

describe('the phone apps store', () => {
  it('keys a snapshot by what shows, not by its closures', () => {
    expect(snapshotKey(snap())).toBe(snapshotKey(snap({ onOpenShare: () => {} })));
    expect(snapshotKey(snap())).not.toBe(snapshotKey(snap({ shareWords: 'Shared' })));
    expect(snapshotKey(snap())).not.toBe(snapshotKey(snap({ onMakeCopy: () => {} })));
    expect(snapshotKey(null)).toBe('');
  });

  it('tells the Apps button only when what shows changes', () => {
    const seen = counter(false);
    act(() => publishPhoneApps(snap()));
    const after = seen.length;
    act(() => publishPhoneApps(snap({ onOpenShare: () => {} })));
    expect(seen.length).toBe(after);
    act(() => publishPhoneApps(snap({ shareWords: 'Shared' })));
    expect(seen.length).toBe(after + 1);
    expect(seen.at(-1)?.shareWords).toBe('Shared');
  });

  it('tells the open drawer every publish, so its handlers are the newest', () => {
    const seen = counter(true);
    const first = () => {};
    const second = () => {};
    act(() => publishPhoneApps(snap({ onOpenShare: first })));
    act(() => publishPhoneApps(snap({ onOpenShare: second })));
    expect(seen.at(-1)?.onOpenShare).toBe(second);
  });

  it('publishes while on a phone, and nothing on a desktop or once unmounted', () => {
    const seen = counter(true);
    function Publisher({ phone }: { phone: boolean }) {
      usePublishPhoneApps(snap({ itemName: 'Board' }), phone);
      return null;
    }
    const { rerender, unmount } = render(<Publisher phone />);
    expect(seen.at(-1)?.itemName).toBe('Board');
    rerender(<Publisher phone={false} />);
    expect(seen.at(-1)).toBeNull();
    rerender(<Publisher phone />);
    expect(seen.at(-1)?.itemName).toBe('Board');
    unmount();
    expect(seen.at(-1)).toBeNull();
  });
});
