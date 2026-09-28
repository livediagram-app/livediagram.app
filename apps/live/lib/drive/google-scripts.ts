// Google's browser libraries, loaded on demand and only where they are used
// (blueprint "Assets and external resources"): Identity Services for the
// browser-only token model, and the Picker for adopting a folder livediagram
// cannot see. Neither loads for a deployment without a client id.

import { DRIVE_FOLDER_MIME, DRIVE_SCOPES, type DriveAccessToken } from '@livediagram/api-schema';
import { googleProjectNumber } from './config';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const GAPI_SRC = 'https://apis.google.com/js/api.js';

const loaded = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  let promise = loaded.get(src);
  if (!promise) {
    promise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loaded.delete(src);
        reject(new Error(`could not load ${src}`));
      };
      document.head.appendChild(script);
    });
    loaded.set(src, promise);
  }
  return promise;
}

type TokenResponse = { access_token?: string; expires_in?: number; error?: string };
type GoogleGlobal = {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        prompt?: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: { type: string }) => void;
      }): { requestAccessToken(overrides?: { prompt?: string }): void };
    };
  };
  picker: PickerNamespace;
};
interface PickerView {
  setSelectFolderEnabled(on: boolean): PickerView;
  setIncludeFolders(on: boolean): PickerView;
  setMimeTypes(types: string): PickerView;
  setParent(id: string): PickerView;
}
type PickerNamespace = {
  DocsView: new (viewId?: string) => PickerView;
  ViewId: { FOLDERS: string };
  Action: { PICKED: string; CANCEL: string };
  PickerBuilder: new () => PickerBuilder;
};
type PickerBuilder = {
  addView(view: unknown): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setAppId(id: string): PickerBuilder;
  setTitle(title: string): PickerBuilder;
  setCallback(cb: (data: { action: string; docs?: { id: string }[] }) => void): PickerBuilder;
  build(): { setVisible(on: boolean): void };
};

function googleGlobal(): GoogleGlobal {
  return (window as unknown as { google: GoogleGlobal }).google;
}

// Browser-only mode: one click, one hour of access (research A3). `prompt: ''`
// consents only the first time.
export async function requestBrowserAccessToken(
  clientId: string,
  now: () => number,
  prompt: '' | 'consent' = '',
): Promise<DriveAccessToken> {
  await loadScript(GIS_SRC);
  return new Promise((resolve, reject) => {
    const client = googleGlobal().accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPES.join(' '),
      prompt,
      callback: (response) => {
        if (!response.access_token || response.error) {
          reject(new Error(response.error ?? 'no access token'));
          return;
        }
        resolve({
          accessToken: response.access_token,
          expiresAt: now() + (response.expires_in ?? 3600) * 1000,
        });
      },
      error_callback: (error) => reject(new Error(error.type)),
    });
    client.requestAccessToken({ prompt });
  });
}

export type FolderPicker = (input: {
  accessToken: string;
  parentId: string | null;
}) => Promise<string | null>;

// Pick one folder. Picking is what grants livediagram access to it under
// drive.file; that is why the Picker needs the project number as its app id.
export function googleFolderPicker(apiKey: string, clientId: string): FolderPicker {
  return async ({ accessToken, parentId }) => {
    await loadScript(GAPI_SRC);
    const gapi = (window as unknown as { gapi: { load(lib: string, cb: () => void): void } }).gapi;
    await new Promise<void>((resolve) => gapi.load('picker', resolve));
    const picker = googleGlobal().picker;
    const view = new picker.DocsView(picker.ViewId.FOLDERS)
      .setSelectFolderEnabled(true)
      .setIncludeFolders(true)
      .setMimeTypes(DRIVE_FOLDER_MIME);
    if (parentId) view.setParent(parentId);
    return new Promise<string | null>((resolve) => {
      let builder = new picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        .setTitle('Show a folder to livediagram')
        .setCallback((data) => {
          if (data.action === picker.Action.PICKED) resolve(data.docs?.[0]?.id ?? null);
          else if (data.action === picker.Action.CANCEL) resolve(null);
        });
      const appId = googleProjectNumber(clientId);
      if (appId) builder = builder.setAppId(appId);
      builder.build().setVisible(true);
    });
  };
}
