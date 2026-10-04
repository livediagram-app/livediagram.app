import type { EditLog } from '@livediagram/edit-operations';

// The changeset log lines (docs/specs/024-agents/blueprints/agent-changesets.md "Observability"):
// one recognisable fingerprint each, with the document, the tab, the changeset id and counts, never
// content.

export type LogFields = Readonly<Record<string, string | number | boolean | null>>;

export function changesetLog(level: 'info' | 'warn', fingerprint: string, fields: LogFields): void {
  if (level === 'warn') console.warn(fingerprint, fields);
  else console.info(fingerprint, fields);
}

// The engine's own lines (`[edit-ops] …`), prefixed with where they happened.
export function engineLog(where: { documentId: string; tabId: string }): EditLog {
  return (fingerprint, fields) => console.info(fingerprint, { ...where, ...fields });
}
