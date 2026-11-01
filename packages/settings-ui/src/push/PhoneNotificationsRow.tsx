'use client';

// Settings > Account > Notifications > Phone (liveworkspace/docs/specs/003-accounts/push.md "Settings"): turning
// phone notifications on for this browser, and the account's devices. One registration serves every app, so the list
// is the account's, whichever app the panel opened in. Reads `GET /push/devices` when it is first shown; registers the
// push-only service worker only when Turn On is pressed.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, ConfirmDialog, relativeSince } from '@liveworkspace/ui';
import { PUSH_DEVICES_PATH } from '@liveworkspace/settings/push';
import { useSettingsUiKit } from '../kit';
import { SettingsRowShell } from '../SettingsRowShell';
import {
  currentSubscription,
  phoneSupport,
  pushDeviceLabel,
  readThisDevice,
  subscribeThisBrowser,
  writeThisDevice,
  type PhoneSupport,
} from './browser-push';
import { DeviceAppLogo } from './DeviceAppLogo';
import { phoneCopy, PHONE_ROW_DESCRIPTION, PHONE_ROW_LABEL, type PhoneState } from './phone-copy';
import type { PhoneHost, PushDeviceView } from './phone-host';

type DevicesAnswer = { publicKey: string | null; devices: PushDeviceView[] };

function DeviceGlyph() {
  const { Glyph } = useSettingsUiKit();
  return (
    <Glyph size={16} units={16} className="shrink-0 text-slate-400 dark:text-slate-500">
      <rect x="4" y="1.5" width="8" height="13" rx="1.75" />
      <path d="M7 12.25h2" />
    </Glyph>
  );
}

export function PhoneNotificationsRow({
  phone,
  support: givenSupport,
  now: givenNow,
}: {
  phone: PhoneHost;
  // Test seams: what the browser can do, and the clock.
  support?: PhoneSupport;
  now?: number;
}) {
  const [support, setSupport] = useState<PhoneSupport>(() => givenSupport ?? phoneSupport());
  const [answer, setAnswer] = useState<DevicesAnswer | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [thisDevice, setThisDevice] = useState<string | null>(null);
  const [removing, setRemoving] = useState<PushDeviceView | null>(null);
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
    },
    [],
  );

  const load = useCallback(async () => {
    const result = await phone.request<DevicesAnswer>(PUSH_DEVICES_PATH);
    if (!live.current) return;
    if (!result.ok) {
      setLoadError(true);
      return;
    }
    setLoadError(false);
    setAnswer(result.data);
    // This browser's device, when its subscription is still the one it registered.
    const stored = readThisDevice();
    const subscription = stored ? await currentSubscription() : null;
    if (!live.current) return;
    const mine =
      stored &&
      subscription?.endpoint === stored.endpoint &&
      result.data.devices.some((d) => d.id === stored.id)
        ? stored.id
        : null;
    setThisDevice(mine);
  }, [phone]);

  useEffect(() => {
    void load();
  }, [load]);

  const turnOn = async () => {
    if (!answer?.publicKey || busy) return;
    setBusy(true);
    setProblem(null);
    const subscribed = await subscribeThisBrowser(answer.publicKey);
    if (!subscribed.ok) {
      if (!live.current) return;
      setBusy(false);
      if (subscribed.reason === 'blocked') setSupport('blocked');
      else setProblem(phoneCopy.subscribeFailed(subscribed.reason));
      return;
    }
    const json = subscribed.subscription.toJSON();
    const result = await phone.request<{ device: PushDeviceView }>(PUSH_DEVICES_PATH, 'POST', {
      endpoint: json.endpoint,
      keys: json.keys,
      label: pushDeviceLabel(navigator.userAgent),
      app: phone.app,
    });
    if (!live.current) return;
    setBusy(false);
    if (!result.ok) {
      // Not kept at accounts: leave the browser unsubscribed rather than half on.
      void subscribed.subscription.unsubscribe().catch(() => {});
      setProblem(phoneCopy.registerFailed);
      return;
    }
    writeThisDevice({ id: result.data.device.id, endpoint: json.endpoint ?? '' });
    await load();
  };

  const remove = async (device: PushDeviceView) => {
    setRemoving(null);
    setProblem(null);
    const result = await phone.request(`${PUSH_DEVICES_PATH}/${device.id}`, 'DELETE');
    if (!live.current) return;
    if (!result.ok && result.status !== 404) {
      setProblem(phoneCopy.removeFailed);
      return;
    }
    if (device.id === thisDevice) {
      const subscription = await currentSubscription();
      await subscription?.unsubscribe().catch(() => false);
      writeThisDevice(null);
    }
    await load();
  };

  const state: PhoneState = loadError
    ? 'unreachable'
    : !answer
      ? 'loading'
      : !answer.publicKey
        ? 'off-here'
        : thisDevice
          ? 'on'
          : support;
  const copy = phoneCopy.state(state);
  const now = givenNow ?? Date.now();
  const devices = answer?.devices ?? [];

  return (
    <div data-phone-notifications data-phone-state={state}>
      <SettingsRowShell
        row={{
          key: 'phoneNotifications',
          label: PHONE_ROW_LABEL,
          description: PHONE_ROW_DESCRIPTION,
        }}
        descriptionContent={copy.description}
        control={
          state === 'ready' ? (
            <Button size="xs" onClick={() => void turnOn()} busy={busy}>
              {busy ? 'Turning On…' : 'Turn On'}
            </Button>
          ) : state === 'unreachable' ? (
            <Button size="xs" variant="secondary" onClick={() => void load()}>
              Try Again
            </Button>
          ) : copy.status ? (
            <span
              data-phone-status
              className={`text-xs font-medium ${
                copy.warn
                  ? 'text-amber-700 dark:text-amber-300'
                  : copy.good
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {copy.status}
            </span>
          ) : null
        }
        notice={problem ?? undefined}
      >
        {devices.length > 0 ? (
          <ul
            aria-label="Devices"
            className="flex flex-col divide-y divide-slate-100 dark:divide-slate-700/60"
          >
            {devices.map((device) => (
              <li
                key={device.id}
                data-push-device={device.id}
                className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
              >
                <DeviceGlyph />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 text-sm text-slate-700 dark:text-slate-200">
                    <span className="truncate">{device.label}</span>
                    {device.id === thisDevice ? (
                      <span className="rounded-full bg-brand-50 px-1.5 py-px text-[11px] font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                        This Device
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      {device.lastSentAt
                        ? `Last notified ${relativeSince(device.lastSentAt, now)}`
                        : `Added ${relativeSince(device.createdAt, now)}`}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      Turned on in <DeviceAppLogo app={device.app} />
                    </span>
                  </div>
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setRemoving(device)}
                  title={`Stop phone notifications on ${device.label}`}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </SettingsRowShell>
      <ConfirmDialog
        open={removing !== null}
        title="Remove This Device?"
        message={phoneCopy.removeMessage(removing?.label ?? '', removing?.id === thisDevice)}
        confirmLabel="Remove"
        onConfirm={() => removing && void remove(removing)}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
