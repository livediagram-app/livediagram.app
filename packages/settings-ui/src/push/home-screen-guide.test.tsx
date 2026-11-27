// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SettingsApiResult, SettingsRequest } from '../request';
import { renderWithKit } from '../test/kit';
import { isAppleMobile, phoneSupport, type PushWindow } from './browser-push';
import {
  homeScreenBrowser,
  homeScreenDevice,
  homeScreenGuide,
  thisBrowserGuide,
} from './home-screen-guide';
import { HomeScreenGuide } from './HomeScreenGuide';
import { PhoneNotificationsRow } from './PhoneNotificationsRow';

// Work Tracker 1498: on an iPad the Phone row's Add to Home Screen did nothing.
const IPAD_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const IPAD_OLD =
  'Mozilla/5.0 (iPad; CPU OS 12_0 like Mac OS X) AppleWebKit/605.1.15 Version/12.0 Mobile/15E148 Safari/604.1';
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD_CHROME =
  'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/130.0 Mobile/15E148 Safari/604.1';
const IPHONE_FIREFOX =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 FxiOS/130.0 Mobile/15E148 Safari/605.1.15';
const IPHONE_EDGE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 EdgiOS/130.0 Mobile/15E148 Safari/605.1.15';
const IPHONE_APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';

const pushWindow = (userAgent: string, maxTouchPoints: number): PushWindow =>
  ({
    navigator: { userAgent, maxTouchPoints, serviceWorker: {} },
    matchMedia: () => ({ matches: false }),
    Notification: { permission: 'default', requestPermission: () => Promise.resolve('granted') },
    PushManager: {},
  }) as unknown as PushWindow;

describe('which device and browser the steps are for', () => {
  it('reads an iPad that says it is a Mac as an iPad, needing the Home Screen', () => {
    expect(homeScreenDevice(IPAD_SAFARI, 5)).toBe('iPad');
    expect(isAppleMobile(pushWindow(IPAD_SAFARI, 5))).toBe(true);
    expect(phoneSupport(pushWindow(IPAD_SAFARI, 5))).toBe('needs-install');
    expect(homeScreenDevice(IPAD_OLD, 5)).toBe('iPad');
  });

  it('reads an iPhone as an iPhone', () => {
    expect(homeScreenDevice(IPHONE_SAFARI, 5)).toBe('iPhone');
    expect(phoneSupport(pushWindow(IPHONE_SAFARI, 5))).toBe('needs-install');
  });

  it('leaves a desktop Mac out: it takes notifications as it is', () => {
    expect(isAppleMobile(pushWindow(IPAD_SAFARI, 0))).toBe(false);
    expect(phoneSupport(pushWindow(IPAD_SAFARI, 0))).toBe('ready');
  });

  it('names the browser', () => {
    expect(homeScreenBrowser(IPAD_SAFARI)).toBe('Safari');
    expect(homeScreenBrowser(IPAD_CHROME)).toBe('Chrome');
    expect(homeScreenBrowser(IPHONE_FIREFOX)).toBe('Firefox');
    expect(homeScreenBrowser(IPHONE_EDGE)).toBe('Edge');
    expect(homeScreenBrowser(IPHONE_APP)).toBe('other');
  });
});

describe('the steps', () => {
  it('puts Share at the top right on an iPad and at the bottom on an iPhone, in Safari', () => {
    const ipad = homeScreenGuide(IPAD_SAFARI, 5);
    expect(ipad.share).toBe('top');
    expect(ipad.steps.map((s) => s.key)).toEqual(['share', 'add', 'open']);
    expect(ipad.steps[0]!.detail).toContain('top right');
    expect(ipad.steps[2]!.detail).toContain('iPad’s Home Screen');
    const iphone = homeScreenGuide(IPHONE_SAFARI, 5);
    expect(iphone.share).toBe('bottom');
    expect(iphone.steps[0]!.detail).toContain('bottom of the screen');
    expect(iphone.steps[2]!.detail).toContain('iPhone’s Home Screen');
  });

  it('points Chrome to its address bar and the others to their menu', () => {
    expect(homeScreenGuide(IPAD_CHROME, 5).steps[0]!.detail).toContain('Chrome’s address bar');
    expect(homeScreenGuide(IPHONE_FIREFOX, 5).steps[0]!.detail).toContain('Firefox’s menu');
    expect(homeScreenGuide(IPHONE_APP, 5).steps[0]!.detail).toContain('your browser’s menu');
  });

  it('reads this browser', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE_SAFARI);
    expect(thisBrowserGuide().device).toBe('iPhone');
  });

  it('draws where Share is for each place, with the same three steps', () => {
    for (const ua of [IPAD_SAFARI, IPHONE_SAFARI, IPHONE_FIREFOX]) {
      const guide = homeScreenGuide(ua, 5);
      const { unmount } = render(<HomeScreenGuide open guide={guide} onClose={() => {}} />);
      const dialog = screen.getByRole('dialog', { name: 'Add to Home Screen' });
      expect(within(dialog).getAllByRole('listitem')).toHaveLength(3);
      expect(within(dialog).getByText(guide.steps[0]!.detail)).toBeTruthy();
      unmount();
    }
  });
});

afterEach(() => vi.restoreAllMocks());

describe('the Phone row on an iPad', () => {
  const ok = <T,>(data: T): SettingsApiResult<T> => ({ ok: true, data });
  const request = vi.fn(async () =>
    ok({ publicKey: 'AQID', devices: [] }),
  ) as unknown as SettingsRequest;

  it('opens the steps from Add to Home Screen, and Done closes them', async () => {
    renderWithKit(
      <PhoneNotificationsRow
        phone={{ request, app: 'liveworkspace' }}
        support="needs-install"
        guide={homeScreenGuide(IPAD_SAFARI, 5)}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Add to Home Screen' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add to Home Screen' });
    expect(within(dialog).getByText(/iPad sends notifications/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Opened again, it keeps the steps it read.
    fireEvent.click(screen.getByRole('button', { name: 'Add to Home Screen' }));
    expect(await screen.findByRole('dialog', { name: 'Add to Home Screen' })).toBeTruthy();
  });

  it('reads this browser when no device is handed in', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE_SAFARI);
    renderWithKit(
      <PhoneNotificationsRow phone={{ request, app: 'liveworkspace' }} support="needs-install" />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Add to Home Screen' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add to Home Screen' });
    expect(within(dialog).getByText(/bottom of the screen/)).toBeTruthy();
  });
});
