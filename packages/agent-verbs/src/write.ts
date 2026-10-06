// One changeset write (docs/specs/015-api/blueprints/cli.md "Writes"): the base from the read copies, the POST,
// `--wait-held` retries, the refusals worded with their next step, warnings as notices, and a fresh read copy
// after a write that rebased over nothing (CLI24, CLI25).

import { z } from 'zod';
import { ApiError } from '@livediagram/api-client';
import {
  CHANGESET_SUMMARY_MAX,
  type ChangesetBase,
  type ChangesetConflict,
  type ChangesetRequest,
  type ChangesetResponse,
  type HeldElement,
} from '@livediagram/api-schema';
import { baseFromCopy, recordCopy } from './copies';
import { VerbRefusal, type VerbContext } from './define';

export const HELD_RETRY_INTERVAL_MS = 2000;
// `--wait-held` waits at most as long as `wait` may (WAIT_MAX_TIMEOUT_S).
export const WAIT_HELD_MAX_S = 3600;

export const writeFlags = {
  dryRun: z.boolean().optional().describe('Plan and print the result without writing'),
  summary: z
    .string()
    .max(CHANGESET_SUMMARY_MAX)
    .optional()
    .describe(`What the change is for, up to ${CHANGESET_SUMMARY_MAX} characters`),
  base: z.coerce
    .number()
    .int()
    .min(0)
    .optional()
    .describe('The revision read; the latest read copy by default'),
  strict: z.boolean().optional().describe('Refuse if the tab changed since the base at all'),
  waitHeld: z.coerce
    .number()
    .int()
    .min(1)
    .max(WAIT_HELD_MAX_S)
    .optional()
    .describe('Retry this many seconds while people hold the elements'),
};

export type WriteFlags = {
  dryRun?: boolean;
  summary?: string;
  // The revision read; null sends no base at all (a tab `push` creates).
  base?: number | null;
  strict?: boolean;
  waitHeld?: number;
};

export type WriteTarget = { documentId: string; tabId: string; tabName: string; doc: string };

async function baseFor(
  ctx: VerbContext,
  target: WriteTarget,
  rev: number | undefined,
): Promise<ChangesetBase | undefined> {
  const { documentId, tabId } = target;
  if (rev !== undefined) {
    const copy = await ctx.copies?.at(documentId, tabId, rev);
    return copy ? baseFromCopy(copy) : { rev };
  }
  const latest = await ctx.copies?.latest(documentId, tabId);
  return latest ? baseFromCopy(latest) : undefined;
}

const bodyOf = (err: ApiError): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(err.body);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

// The api's refusal of a write, worded with what to do next; other answers pass through.
function refusalOf(err: unknown, target: WriteTarget, base: ChangesetBase | undefined): unknown {
  if (!(err instanceof ApiError)) return err;
  const body = bodyOf(err);
  const since = `since ${base ? `rev ${base.rev}` : 'your read'}${typeof body.rev === 'number' ? ` (now ${body.rev})` : ''}`;
  const reread = `re-read: livediagram tab view ${JSON.stringify(target.doc)} --tab ${JSON.stringify(target.tabName)}`;
  if (err.code === 'elements_held') {
    const held = (body.held ?? []) as HeldElement[];
    return new VerbRefusal({
      status: 409,
      code: 'elements_held',
      message: `${held.length} element${held.length === 1 ? ' is' : 's are'} selected by people:`,
      lines: held.map((h) => `${h.id} (${h.by.name})`),
      hint: 'retry later, or add --wait-held 30',
    });
  }
  if (err.code === 'changeset_conflict') {
    const conflicts = (body.conflicts ?? []) as ChangesetConflict[];
    return new VerbRefusal({
      status: 409,
      code: 'changeset_conflict',
      message: `${conflicts.length} element${conflicts.length === 1 ? '' : 's'} changed ${since}:`,
      lines: conflicts.map((c) => `${c.id} (${c.reason.replace(/_/g, ' ')})`),
      hint: reread,
    });
  }
  if (err.code === 'stale_tab')
    return new VerbRefusal({
      status: 412,
      code: 'stale_tab',
      message: `${JSON.stringify(target.tabName)} changed ${since}`,
      hint: reread,
    });
  return err;
}

export async function submitChangeset(
  ctx: VerbContext,
  target: WriteTarget,
  body: Pick<ChangesetRequest, 'operations' | 'replace'>,
  flags: WriteFlags,
): Promise<ChangesetResponse> {
  const base = flags.base === null ? undefined : await baseFor(ctx, target, flags.base);
  const request: ChangesetRequest = {
    ...body,
    ...(base ? { base } : {}),
    ...(flags.strict ? { strict: true } : {}),
    ...(flags.summary ? { summary: flags.summary } : {}),
  };
  const path = `/documents/${encodeURIComponent(target.documentId)}/tabs/${encodeURIComponent(target.tabId)}/changesets${flags.dryRun ? '?dryRun=1' : ''}`;
  const started = ctx.now();
  let response: ChangesetResponse;
  for (let attempt = 1; ; attempt += 1) {
    try {
      response = await ctx.api.json<ChangesetResponse>(path, {
        method: 'POST',
        body: JSON.stringify(request),
      });
      break;
    } catch (err) {
      const held = err instanceof ApiError && err.code === 'elements_held';
      if (
        !held ||
        !flags.waitHeld ||
        ctx.now() - started + HELD_RETRY_INTERVAL_MS > flags.waitHeld * 1000
      )
        throw refusalOf(err, target, base);
      ctx.log(`held retry ${attempt}`);
      await ctx.sleep(HELD_RETRY_INTERVAL_MS);
    }
  }
  for (const warning of response.warnings) ctx.notice(`warning: ${warning}`);
  if (response.changeset && response.changeset.rebasedOver === 0)
    await recordCopy(ctx, target.documentId, target.tabId);
  return response;
}
