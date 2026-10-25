// The splitter (docs/migration.md, step 3 and "Tooling"): one old livediagram document in, one payload per app out.
// Pure; everything product-specific comes in through SplitHooks.
import type {
  LocalDocumentInput,
  LocalSplitResult,
  OldDocumentInput,
  SplitHooks,
  SplitResult,
} from './contract';

/** Splits one old document from the server snapshot into its parts. */
export function splitOldDocument(_input: OldDocumentInput, _hooks: SplitHooks): SplitResult {
  throw new Error('splitOldDocument: not built yet');
}

/** Splits one Local only document from a browser's store: what stays local, and the parts for the other apps. */
export function splitLocalDocument(
  _input: LocalDocumentInput,
  _hooks: SplitHooks,
): LocalSplitResult {
  throw new Error('splitLocalDocument: not built yet');
}

/** Whether a raw stored tab holds anything livediagram no longer reads (Pages or Plan content), so it must be set
 *  aside before the editor reads it. */
export function hasRetiredContent(_tab: unknown): boolean {
  throw new Error('hasRetiredContent: not built yet');
}
