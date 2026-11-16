// A plan's board addresses as Email to Board manages them (docs/specs/026-plan/email-to-board.md "Managing an
// address"), typed with @liveplanner/api-schema. The dialog opens only for an Editor of the whole plan
// (email-intake-gate.ts); an Editor link's code rides along.
import type {
  EmailIntakeResponse,
  EmailIntakeSenders,
  EmailIntakesResponse,
} from '@liveplanner/api-schema';
import { API_BASE, apiFetch, apiHeaders, expectOk, expectOkVoid } from '@/lib/api/core';
import type { EmailIntakeScope } from './email-intake-gate';

const url = (scope: EmailIntakeScope, rest = '') =>
  `${API_BASE}/projects/${encodeURIComponent(scope.projectId)}/email-intake${rest}`;

const board = (boardId: string) => `/${encodeURIComponent(boardId)}`;

async function call(
  scope: EmailIntakeScope,
  method: string,
  rest = '',
  body?: unknown,
): Promise<Response> {
  return apiFetch(url(scope, rest), {
    method,
    headers: await apiHeaders(scope.ownerId, {
      share: scope.shareCode,
      body: body !== undefined,
    }),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/** The plan's addresses, the boards that may have one, and whether this server takes mail. */
export async function readEmailIntakes(scope: EmailIntakeScope): Promise<EmailIntakesResponse> {
  return expectOk<EmailIntakesResponse>(await call(scope, 'GET'), 'read email intakes');
}

/** Turn the board's address on, or change Who Can Send (the address kept). */
export async function saveEmailIntake(
  scope: EmailIntakeScope,
  boardId: string,
  senders: EmailIntakeSenders,
): Promise<EmailIntakeResponse> {
  return expectOk<EmailIntakeResponse>(
    await call(scope, 'PUT', board(boardId), { senders }),
    'save email intake',
  );
}

/** A new address: the old one stops at once. */
export async function newEmailIntakeAddress(
  scope: EmailIntakeScope,
  boardId: string,
): Promise<EmailIntakeResponse> {
  return expectOk<EmailIntakeResponse>(
    await call(scope, 'POST', `${board(boardId)}/new-address`),
    'new email intake address',
  );
}

/** Turn Off: mail to the address is refused from now on. */
export async function turnOffEmailIntake(scope: EmailIntakeScope, boardId: string): Promise<void> {
  return expectOkVoid(await call(scope, 'DELETE', board(boardId)), 'turn off email intake');
}
