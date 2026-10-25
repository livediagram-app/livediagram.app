// What a person's mirror runs on (liveworkspace/docs/drive.md "The service"): its store, its alarm, Google, the
// index, the apps' doors and the clock, all injected, so the Durable Object is a thin shell and the tests run the
// same code on node:sqlite, the fake Google and in-memory stand-ins.

import type { DriveEnvironment } from '@liveworkspace/drive';
import type { DriveClient, GoogleConfig } from '@liveworkspace/drive/server';
import type { AppDoors } from '../app-doors';
import type { IndexApi } from '../index-api';
import type { Rasterise } from '../thumbnail';
import type { MirrorStore } from './store';
import type { TokenSource } from './tokens';

/** The object's alarm: when its next pass runs. */
export interface Scheduler {
  getAlarm(): Promise<number | null>;
  setAlarm(at: number): Promise<void>;
  deleteAlarm(): Promise<void>;
}

export type MirrorDeps = {
  store: MirrorStore;
  scheduler: Scheduler;
  google: GoogleConfig;
  // DRIVE_TOKEN_KEY: seals refresh tokens; the channel token's key is derived from it.
  tokenKey: string;
  // liveworkspace's origin in this environment: the files' lwOrigin, the root's lwRoot.
  origin: string;
  environment: DriveEnvironment;
  // Where Google posts change notifications.
  pushAddress: string;
  index: IndexApi;
  doors: AppDoors;
  rasterise: Rasterise;
  now: () => number;
  newId: () => string;
};

/** One person's mirror at work: its deps, its tokens and Drive client, and a check that it is still connected. */
export type Runtime = {
  deps: MirrorDeps;
  personId: string;
  tokens: TokenSource;
  drive: DriveClient;
  // Throws PassAborted once the person disconnected or switched Google account since this work began.
  guard: () => void;
};

/** The work in hand belongs to a connection that has since gone (disconnected, or another Google account). */
export class PassAborted extends Error {
  constructor() {
    super('drive: pass aborted');
    this.name = 'PassAborted';
  }
}
