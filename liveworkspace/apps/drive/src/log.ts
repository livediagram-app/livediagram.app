// The service's log lines (liveworkspace/docs/drive.md "Logs"): `drive: <step>` and ids, never a name or an address,
// so a failure is traceable in `wrangler tail` without the log holding anyone's work.

type Fields = Record<string, string | number | boolean | null | undefined>;

export function driveLog(step: string, fields: Fields = {}): void {
  console.log(`drive: ${step}`, fields);
}

export function driveWarn(step: string, fields: Fields = {}): void {
  console.warn(`drive: ${step}`, fields);
}

/** An error's kind for a log line: its name and status, never its message (Google's can quote a file name). */
export function errorKind(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { name?: unknown; status?: unknown; reason?: unknown; kind?: unknown };
    const parts = [e.name, e.status, e.reason, e.kind].filter(
      (p) => typeof p === 'string' || typeof p === 'number',
    );
    if (parts.length > 0) return parts.join(' ');
  }
  return typeof err;
}
