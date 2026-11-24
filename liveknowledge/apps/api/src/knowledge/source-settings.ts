// What a knowledgebase reads besides its pages (docs/specs/030-knowledgebase/search-and-ask.md "Sources in AI
// Settings"): Connected Items (on unless an Editor turned it off) and one team folder (none unless chosen). Kept as
// rows of `knowledge_settings`, beside the key and the model; no row is the default.
import { putSetting, readSetting, type SqlStatement } from '@liveknowledge/knowledge';
import type { DocumentEnv } from '../types';
import { rowsOf } from './knowledge-db';

export const SETTING_SOURCES_CONNECTED = 'sources_connected';
export const SETTING_SOURCES_FOLDER = 'sources_folder';
export const SETTING_SOURCES_FOLDER_NAME = 'sources_folder_name';
/** A folder's name is kept for AI Settings to show, cut to the index's title length. */
export const SOURCE_FOLDER_NAME_MAX = 200;

export type SourceSettings = {
  connected: boolean;
  folderId: string | null;
  folderName: string | null;
};

const settingOf = async (env: DocumentEnv, name: string): Promise<string | null> =>
  (await rowsOf<{ value: string }>(env, readSetting(name)))[0]?.value ?? null;

export async function readSourceSettings(env: DocumentEnv): Promise<SourceSettings> {
  const [connected, folderId, folderName] = await Promise.all([
    settingOf(env, SETTING_SOURCES_CONNECTED),
    settingOf(env, SETTING_SOURCES_FOLDER),
    settingOf(env, SETTING_SOURCES_FOLDER_NAME),
  ]);
  return {
    connected: connected !== '0',
    folderId: folderId || null,
    folderName: folderId ? folderName || null : null,
  };
}

const ID = /^[A-Za-z0-9_-]{1,200}$/;

/** An Editor's change, read defensively: the statements that store it, or null for a body that changes nothing or
 *  names no folder id. */
export function sourceSettingsWrites(body: Record<string, unknown> | null): SqlStatement[] | null {
  if (!body) return null;
  const writes: SqlStatement[] = [];
  if (body.connected !== undefined) {
    if (typeof body.connected !== 'boolean') return null;
    writes.push(putSetting(SETTING_SOURCES_CONNECTED, body.connected ? '1' : '0'));
  }
  if (body.folderId !== undefined) {
    if (body.folderId !== null && (typeof body.folderId !== 'string' || !ID.test(body.folderId)))
      return null;
    const name =
      typeof body.folderName === 'string'
        ? body.folderName.trim().slice(0, SOURCE_FOLDER_NAME_MAX)
        : '';
    writes.push(
      putSetting(SETTING_SOURCES_FOLDER, body.folderId ?? ''),
      putSetting(SETTING_SOURCES_FOLDER_NAME, body.folderId ? name : ''),
    );
  }
  return writes.length ? writes : null;
}
