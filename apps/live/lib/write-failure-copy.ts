// What a failed folder or document write says (docs/specs/013-workspace/folders.md "A write that fails says so"):
// one wording per verb, shared by the Explorer page, the editor's Explorer panel and a team's library, so the same
// failure reads the same wherever it happened. Each names what it failed on when the caller knows it (toast-name.ts).
import { toastName } from './toast-name';

type FailureCopy = (name?: string | null) => string;

const failure =
  (verb: string, fallback: string): FailureCopy =>
  (name) =>
    `Could not ${verb} ${toastName(name) ?? fallback}. Try again.`;

export const FOLDER_FAILURE = {
  create: failure('create', 'the folder'),
  rename: failure('rename', 'the folder'),
  move: failure('move', 'the folder'),
  delete: failure('delete', 'the folder'),
} as const satisfies Record<string, FailureCopy>;

export const DOCUMENT_FAILURE = {
  rename: failure('rename', 'the document'),
  move: failure('move', 'the document'),
  delete: failure('delete', 'the document'),
  duplicate: failure('duplicate', 'the document'),
} as const satisfies Record<string, FailureCopy>;
