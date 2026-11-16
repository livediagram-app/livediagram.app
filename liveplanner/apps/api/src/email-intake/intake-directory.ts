// Which plan and board a code belongs to (docs/specs/026-plan/email-to-board.md "How it is kept"; blueprint
// email-to-board.md "Files"): a message names only its code, and plan ids are not in addresses, so each code has one
// instance of the worker's PLAN_ROOM Durable Object named `~mail:<code>` (no new binding, class or migration; no plan
// id starts with `~`). It holds one storage key, `{ planId, boardId }`, and never a plan schema.
import type { Env } from '../types';

export const INTAKE_DIRECTORY_KEY = 'intake';

export type IntakeEntry = { planId: string; boardId: string };

/** The PLAN_ROOM instance that files a code. */
export const intakeDirectoryName = (code: string): string => `~mail:${code}`;

type DirectoryStorage = Pick<DurableObjectStorage, 'get' | 'put' | 'delete'>;

/** The room's side: the entry it holds, or null. */
export async function readDirectoryEntry(storage: DirectoryStorage): Promise<IntakeEntry | null> {
  const entry = await storage.get<IntakeEntry>(INTAKE_DIRECTORY_KEY);
  return entry && typeof entry.planId === 'string' && typeof entry.boardId === 'string'
    ? entry
    : null;
}

/** The room's side: the entry written, or deleted for null. */
export async function writeDirectoryEntry(
  storage: DirectoryStorage,
  entry: IntakeEntry | null,
): Promise<void> {
  if (entry) await storage.put(INTAKE_DIRECTORY_KEY, entry);
  else await storage.delete(INTAKE_DIRECTORY_KEY);
}

type DirectoryRpc = {
  intakeEntry(): Promise<IntakeEntry | null>;
  setIntakeEntry(entry: IntakeEntry | null): Promise<void>;
};

const directoryRoom = (env: Pick<Env, 'PLAN_ROOM'>, code: string): DirectoryRpc => {
  const ns = env.PLAN_ROOM;
  return ns.get(ns.idFromName(intakeDirectoryName(code)));
};

/** The plan and board a code names, or null. */
export const findIntake = (env: Pick<Env, 'PLAN_ROOM'>, code: string) =>
  directoryRoom(env, code).intakeEntry();

/** The code filed under its plan and board. */
export const fileIntake = (env: Pick<Env, 'PLAN_ROOM'>, code: string, entry: IntakeEntry) =>
  directoryRoom(env, code).setIntakeEntry(entry);

/** The code's entry removed: mail to it is refused from now on. */
export const unfileIntake = (env: Pick<Env, 'PLAN_ROOM'>, code: string) =>
  directoryRoom(env, code).setIntakeEntry(null);
