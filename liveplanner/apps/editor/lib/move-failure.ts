// What failed, as `[explorer-move] <kind> failed` logs it (docs/specs/013-workspace/folders.md "A move that
// fails says so").
type MoveFailure =
  'project' | 'project-to-team' | 'team-project' | 'team-project-out' | 'folder' | 'new-folder';

/** Logs a failed move with its subject (` project=<id>`, or none) and what went wrong. */
export function logMoveFailure(kind: MoveFailure, subject: string, err: unknown): void {
  console.warn(
    `[explorer-move] ${kind} failed${subject}: ${err instanceof Error ? err.message : String(err)}`,
  );
}
