// livediagram.toml (docs/specs/027-repositories/repository-link.md "The link file"; blueprint "The link file"):
// read with smol-toml (RL1), then checked key by key. Unknown keys are refused by name at every level the spec
// names, so a typo never silently does nothing; `[hooks]` and `[[sources]]` are checked and left unread (RL2).

import { posix } from 'node:path';
import { MIRROR_LEVELS } from '@livediagram/agent-verbs';
import { parse, TomlError } from 'smol-toml';
import { didYouMean } from '../dispatch/did-you-mean';
import { CliError } from '../output/cli-error';
import { EXIT, type ExitCode } from '../output/exit-codes';
import { LINK_ID_MAX, MIRROR_DEFAULT_DIR, MIRROR_DEFAULT_LEVEL } from './constants';

export type MirrorLevel = (typeof MIRROR_LEVELS)[number];

export type LinkFile = {
  // The real path of livediagram.toml.
  path: string;
  // Its directory.
  root: string;
  // An origin; null: the active profile's.
  host: string | null;
  covers: { folder: string | null; documents: string[] };
  // dir: normalised, POSIX separators, relative to root.
  mirror: { level: MirrorLevel; dir: string };
  // Validated; read by the git slice.
  hooks: { block: boolean };
  // [[sources]], owned by diagram-sources; unread in this slice.
  sources: Record<string, unknown>[];
};

const KEYS: Record<string, readonly string[]> = {
  '': ['host', 'covers', 'mirror', 'hooks', 'sources'],
  covers: ['folder', 'documents'],
  mirror: ['level', 'dir'],
  hooks: ['block'],
};

type Table = Record<string, unknown>;

const isTable = (value: unknown): value is Table =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);

const refuse = (exit: ExitCode, code: string, message: string, hint?: string) =>
  new CliError({ exit, code, message, ...(hint ? { hint } : {}) });

function syntaxError(err: unknown, path: string): CliError {
  if (!(err instanceof TomlError)) throw err;
  const reason = err.message.split('\n')[0]!.replace(/^Invalid TOML document: /, '');
  return refuse(
    EXIT.usage,
    'link_syntax',
    `${path} line ${err.line}, column ${err.column}: ${reason}`,
    'fix the line; livediagram.toml is TOML',
  );
}

function checkKeys(table: Table, name: string, path: string): void {
  const known = KEYS[name]!;
  const unknown = Object.keys(table).find((key) => !known.includes(key));
  if (unknown === undefined) return;
  const near = didYouMean(unknown, known);
  throw new CliError({
    exit: EXIT.usage,
    code: 'unknown_key',
    message: `${path}: unknown key "${name ? `${name}.` : ''}${unknown}"`,
    ...(near ? { lines: [`did you mean: ${near}`] } : {}),
    hint: name
      ? `the keys of [${name}]: ${known.join(', ')}`
      : `the top-level keys: ${known.join(', ')}`,
  });
}

const wrongType = (path: string, key: string, type: string) =>
  refuse(
    EXIT.usage,
    'wrong_type',
    `${path}: ${key} must be ${type}`,
    'livediagram link init --help',
  );

// A table that may be absent: its keys checked, or an empty one.
function tableAt(root: Table, name: string, path: string): Table {
  const value = root[name];
  if (value === undefined) return {};
  if (!isTable(value)) throw wrongType(path, name, 'a table');
  checkKeys(value, name, path);
  return value;
}

// `name` is the key as the refusal names it: `host`, `covers.folder`.
function stringAt(table: Table, key: string, name: string, path: string): string | null {
  const value = table[key];
  if (value === undefined) return null;
  if (typeof value !== 'string') throw wrongType(path, name, 'a string');
  return value;
}

function originOf(value: string, path: string): string {
  const invalid = () =>
    refuse(
      EXIT.rejected,
      'invalid_host',
      `${path}: host must be an origin such as https://livediagram.app, not ${value}`,
    );
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw invalid();
  }
  if (
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== '' ||
    value.includes('?') ||
    value.includes('#')
  )
    throw invalid();
  return url.origin;
}

function checkId(id: string, key: string, path: string): string {
  if (id === '' || /\s/.test(id) || id.length > LINK_ID_MAX)
    throw refuse(
      EXIT.rejected,
      'empty_id',
      `${path}: ${key} holds an empty or spaced id`,
      'livediagram link ls',
    );
  return id;
}

function coversOf(table: Table, path: string): LinkFile['covers'] {
  const folder = stringAt(table, 'folder', 'covers.folder', path);
  const listed = table.documents;
  if (
    listed !== undefined &&
    (!Array.isArray(listed) || !listed.every((d) => typeof d === 'string'))
  )
    throw wrongType(path, 'covers.documents', 'an array of strings');
  const documents = (listed ?? []) as string[];
  if (folder === null && documents.length === 0)
    throw refuse(
      EXIT.rejected,
      'no_coverage',
      `${path}: [covers] needs a folder, documents, or both`,
      'livediagram link init --folder <folder>',
    );
  if (folder !== null) checkId(folder, 'covers.folder', path);
  const seen = new Set<string>();
  for (const id of documents) {
    checkId(id, 'covers.documents', path);
    if (seen.has(id))
      throw refuse(
        EXIT.rejected,
        'duplicate_document',
        `${path}: covers.documents lists ${id} twice`,
      );
    seen.add(id);
  }
  return { folder, documents };
}

// `dir` normalised to POSIX segments; `.` is the link root itself; `..`, absolute and empty are refused (RL3).
function dirOf(value: string, root: string, path: string): string {
  const slashed = value.replace(/\\/g, '/');
  const normalised = posix.normalize(slashed).replace(/(.)\/+$/, '$1');
  if (slashed.trim() === '' || posix.isAbsolute(normalised) || slashed.split('/').includes('..'))
    throw refuse(
      EXIT.rejected,
      'invalid_dir',
      `${path}: mirror.dir must stay inside ${root}, not "${value}"`,
    );
  return normalised;
}

function mirrorOf(table: Table, root: string, path: string): LinkFile['mirror'] {
  const level = table.level;
  const dir = table.dir;
  if (level !== undefined && typeof level !== 'string')
    throw wrongType(path, 'mirror.level', 'a string');
  if (dir !== undefined && typeof dir !== 'string') throw wrongType(path, 'mirror.dir', 'a string');
  if (level !== undefined && !MIRROR_LEVELS.some((l) => l === level))
    throw refuse(
      EXIT.rejected,
      'invalid_level',
      `${path}: mirror.level must be none, index or files, not "${level}"`,
    );
  return {
    level: (level ?? MIRROR_DEFAULT_LEVEL) as MirrorLevel,
    dir: dir === undefined ? MIRROR_DEFAULT_DIR : dirOf(dir, root, path),
  };
}

export function parseLinkFile(text: string, path: string): LinkFile {
  let raw: Table;
  try {
    raw = parse(text);
  } catch (err) {
    throw syntaxError(err, path);
  }
  checkKeys(raw, '', path);
  const root = posix.dirname(path);
  const host = stringAt(raw, 'host', 'host', path);
  const covers = tableAt(raw, 'covers', path);
  const mirror = tableAt(raw, 'mirror', path);
  const hooks = tableAt(raw, 'hooks', path);
  const sources = raw.sources;
  if (sources !== undefined && (!Array.isArray(sources) || !sources.every(isTable)))
    throw wrongType(path, 'sources', 'an array of tables');
  const block = hooks.block;
  if (block !== undefined && typeof block !== 'boolean')
    throw wrongType(path, 'hooks.block', 'a boolean');
  return {
    path,
    root,
    host: host === null ? null : originOf(host, path),
    covers: coversOf(covers, path),
    mirror: mirrorOf(mirror, root, path),
    hooks: { block: block ?? false },
    sources: (sources ?? []) as Record<string, unknown>[],
  };
}

const tomlString = (value: string) => JSON.stringify(value);

// What `link init` writes (blueprint "The link file", final copy): keys in this order, LF endings; `host` always
// (RL28), `folder`, `documents` and `[mirror]` only when given.
export function linkFileText(link: {
  host: string;
  folder?: string | null;
  documents: readonly string[];
  level?: MirrorLevel;
}): string {
  return [
    `# This repository's diagrams live in livediagram; see ${link.host}/help/developers/repositories/`,
    `host = ${tomlString(link.host)}`,
    '',
    '[covers]',
    ...(link.folder ? [`folder = ${tomlString(link.folder)}`] : []),
    ...(link.documents.length > 0
      ? [`documents = [${link.documents.map(tomlString).join(', ')}]`]
      : []),
    ...(link.level ? ['', '[mirror]', `level = ${tomlString(link.level)}`] : []),
    '',
  ].join('\n');
}

// Two hosts as one site: their origins, a leading `www.` ignored, as `parseDocumentUrl` compares (RL5).
export const sameHost = (a: string, b: string) =>
  new URL(a).origin.replace('://www.', '://') === new URL(b).origin.replace('://www.', '://');
