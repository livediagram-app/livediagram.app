// Any thrown thing as the failure the CLI reports (docs/specs/015-api/cli.md "Exit codes", blueprint CLI14-16):
// its exit code, a stable code, one line, candidates and a runnable fix. Never a stack trace.

import { AddressError, VerbRefusal } from '@livedocuments/agent-verbs';
import { ApiError } from '@liveworkspace/api-client';
import { CliError, type CliFailure } from './cli-error';
import { EXIT, exitCodeForStatus } from '@liveworkspace/cli-kit/exit-codes';

// A request that never got an answer: no connection, a timeout, an abort.
export const isNetworkFailure = (err: unknown): err is Error =>
  err instanceof Error && ['TypeError', 'TimeoutError', 'AbortError'].includes(err.name);

export const ISSUES_URL = 'https://github.com/livedocuments-app/livedocuments.app/issues';

function addressFailure(err: AddressError): CliFailure {
  const { kind, candidates, message, hint } = err.failure;
  return {
    exit: kind === 'usage' ? EXIT.usage : EXIT.notFound,
    code: kind === 'not-found' ? 'not_found' : kind,
    message: kind === 'not-found' && candidates.length > 0 ? `${message}; the nearest:` : message,
    lines: candidates.map(
      (c) => `${c.ref.padEnd(10)}${JSON.stringify(c.name).padEnd(24)}${c.detail}`,
    ),
    hint,
  };
}

const bodyOf = (body: string): { message?: string; text?: string } => {
  try {
    const parsed: unknown = JSON.parse(body);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

function apiFailure(err: ApiError, host: string): CliFailure {
  const exit = exitCodeForStatus(err.status);
  const code = err.code ?? `http_${err.status}`;
  const { message, text } = bodyOf(err.body);
  const lines = text ? { lines: text.split('\n') } : {};
  switch (exit) {
    case EXIT.auth:
      return {
        exit,
        code,
        message:
          err.status === 401
            ? `${host} did not accept the credential (${code})`
            : `refused: ${code}`,
        hint:
          err.status === 401
            ? 'livedocuments auth login --with-token, or set LIVEDOCUMENTS_TOKEN'
            : 'livedocuments auth status',
      };
    case EXIT.rateLimited:
      return {
        exit,
        code,
        message: `${host} is rate limiting this token`,
        hint: 'wait a minute, then retry',
      };
    case EXIT.failure:
      return { exit, code, message: `${host} failed (HTTP ${err.status})`, hint: 'retry shortly' };
    default:
      return { exit, code, message: message ?? (text ? `refused: ${code}` : code), ...lines };
  }
}

export function failureOf(err: unknown, host: string): CliFailure {
  if (err instanceof CliError) return err.failure;
  if (err instanceof AddressError) return addressFailure(err);
  if (err instanceof VerbRefusal)
    return {
      // A command line the verb cannot use exits as any other usage error.
      exit: err.code === 'usage' ? EXIT.usage : exitCodeForStatus(err.status),
      code: err.code,
      message: err.message,
      lines: err.lines,
      hint: err.hint,
    };
  if (err instanceof ApiError) return apiFailure(err, host);
  if (isNetworkFailure(err))
    return {
      exit: EXIT.failure,
      code: 'network',
      message: `could not reach ${host} (${err.message})`,
      hint: 'check the connection, or choose another host with --host',
    };
  return {
    exit: EXIT.failure,
    code: 'internal',
    message: `internal error (${err instanceof Error ? err.name : typeof err})`,
    hint: `run again with LIVEDOCUMENTS_DEBUG=1 and report it at ${ISSUES_URL}`,
  };
}
