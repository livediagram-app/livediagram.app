// What the Settings panel's Phone section needs from its host (liveworkspace/docs/specs/003-accounts/push.md
// "Settings"): the panel's own door to the accounts API (the session on liveworkspace.app, the app's bearer on an
// app's address and in the editors) and the app it opened in, which the device list shows beside the device it
// registers, by its logo.
import type { PushDeviceApp } from '@liveworkspace/settings/push';
import type { SettingsRequest } from '../request';

export type PhoneHost = {
  request: SettingsRequest;
  // The app the panel opened in, or `liveworkspace` on liveworkspace.app.
  app: PushDeviceApp;
};

/** A device as `GET /push/devices` lists it. */
export type PushDeviceView = {
  id: string;
  label: string;
  app: PushDeviceApp;
  createdAt: number;
  lastSentAt: number | null;
};
