// Reading an Excalidraw envelope (docs/specs/020-import-export/excalidraw-import-export.md "Envelopes"):
// a clipboard copy, an API copy or a saved scene. Never throws: a bad input is a named rejection
// with the message the Import dialog or the paste toast shows.

import {
  EXCALIDRAW_ENVELOPE_TYPES,
  type ExcalidrawAppState,
  type ExcalidrawElement,
  type ExcalidrawEnvelope,
  type ExcalidrawEnvelopeType,
  type ExcalidrawFiles,
} from './excalidraw-types';
import { isRecord } from '@livediagram/document';

/** Excalidraw caps one image at 4 MiB; this admits about a dozen as data URLs. */
export const EXCALIDRAW_MAX_SCENE_CHARS = 64 * 1024 * 1024;
/** How much of a text the cheap paste test looks at. */
export const EXCALIDRAW_DETECT_PREFIX_CHARS = 256;

export type ExcalidrawRejection =
  'too-large' | 'not-json' | 'not-object' | 'not-excalidraw' | 'no-elements';

const MESSAGES: Record<ExcalidrawRejection, string> = {
  'too-large': 'This Excalidraw scene is too large to import.',
  'not-json': "File isn't valid JSON.",
  'not-object': 'Expected a JSON object at the top level.',
  'not-excalidraw': 'This isn\'t an Excalidraw scene (missing "type": "excalidraw").',
  'no-elements': 'Scene is missing its elements array.',
};

export type ReadEnvelopeResult =
  | { ok: true; envelope: ExcalidrawEnvelope }
  | { ok: false; rejection: ExcalidrawRejection; error: string };

const PREFIX = /^\s*\{\s*"type"\s*:\s*"excalidraw(?:\/clipboard|-api\/clipboard)?"/;

/** Whether a text opens like an Excalidraw envelope. No parse: cheap on every paste. */
export function looksLikeExcalidraw(text: string): boolean {
  return PREFIX.test(text.slice(0, EXCALIDRAW_DETECT_PREFIX_CHARS));
}

const reject = (rejection: ExcalidrawRejection): ReadEnvelopeResult => ({
  ok: false,
  rejection,
  error: MESSAGES[rejection],
});

export function readExcalidrawEnvelope(
  text: string,
  maxChars: number = EXCALIDRAW_MAX_SCENE_CHARS,
): ReadEnvelopeResult {
  if (text.length > maxChars) return reject('too-large');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return reject('not-json');
  }
  if (!isRecord(raw)) return reject('not-object');
  const type = raw.type;
  if (!EXCALIDRAW_ENVELOPE_TYPES.includes(type as ExcalidrawEnvelopeType)) {
    return reject('not-excalidraw');
  }
  if (!Array.isArray(raw.elements)) return reject('no-elements');
  const elements = (raw.elements as unknown[]).filter(
    (e): e is ExcalidrawElement => isRecord(e) && e.isDeleted !== true,
  );
  const files = isRecord(raw.files) ? (raw.files as ExcalidrawFiles) : {};
  const envelope: ExcalidrawEnvelope = {
    type: type as ExcalidrawEnvelopeType,
    elements,
    files,
  };
  if (type === 'excalidraw' && isRecord(raw.appState)) {
    envelope.appState = raw.appState as ExcalidrawAppState;
  }
  return { ok: true, envelope };
}
