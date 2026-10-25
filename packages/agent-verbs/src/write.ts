// One changeset write (docs/specs/015-api/blueprints/cli.md "Writes"): the base from the read copies, the POST,
// `--wait-held` retries, the refusals worded with their next step, warnings as notices, and a fresh read copy
// after a write that rebased over nothing (CLI24, CLI25). Each product binds it to its collection, CLI, read copies
// and changeset types (its write.ts).

import { z } from 'zod';
import { ApiError } from '@liveworkspace/api-client';
import type { CopyBase, ReadCopies, ReadCopy } from './copies';
import { VerbRefusal, type VerbContext } from './define';
import type { AgentProduct } from './product';

// What a write reads of the api's answers (each product's api-schema `ChangesetResponse`, `HeldElement` and
// `ChangesetConflict` are these, and more).
export type ChangesetAnswer = {
  warnings: string[];
  changeset?: { rebasedOver: number } | null;
};
type HeldElement = { id: string; by: { name: string } };
type ChangesetConflict = { id: string; reason: string };

export const HELD_RETRY_INTERVAL_MS = 2000;
// `--wait-held` waits at most as long as `wait` may (WAIT_MAX_TIMEOUT_S).
const WAIT_HELD_MAX_S = 3600;

export function writeFlagsOf(summaryMax: number) {
  return {
    dryRun: z.boolean().optional().describe('Plan and print the result without writing'),
    summary: z
      .string()
      .max(summaryMax)
      .optional()
      .describe(`What the change is for, up to ${summaryMax} characters`),
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
}

export type WriteFlags = {
  dryRun?: boolean;
  summary?: string;
  // The revision read; null sends no base at all (a tab `push` creates).
  base?: number | null;
  strict?: boolean;
  waitHeld?: number;
};

// The tab a write goes to: the file's and the tab's ids, the tab's name and the file as the command named it (for
// the re-read hint).
export type WriteTarget = { fileId: string; tabId: string; tabName: string; ref: string };

const bodyOf = (err: ApiError): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(err.body);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

export type WriteBinding<Tab> = {
  product: Pick<AgentProduct, 'cli' | 'collection'>;
  // The product's read copies (./copies `createReadCopies`).
  baseFromCopy: (copy: ReadCopy<Tab>) => CopyBase;
  recordCopy: (ctx: WriteContext<Tab>, fileId: string, tabId: string) => Promise<unknown>;
  // The longest a changeset summary may be (each product's api-schema `CHANGESET_SUMMARY_MAX`).
  summaryMax: number;
};

type WriteContext<Tab> = VerbContext<ReadCopies<Tab>>;

export function createWrite<Tab>({
  product,
  baseFromCopy,
  recordCopy,
  summaryMax,
}: WriteBinding<Tab>) {
  const { cli, collection } = product;

  async function baseFor(
    ctx: WriteContext<Tab>,
    target: WriteTarget,
    rev: number | undefined,
  ): Promise<CopyBase | undefined> {
    const { fileId, tabId } = target;
    if (rev !== undefined) {
      const copy = await ctx.copies?.at(fileId, tabId, rev);
      return copy ? baseFromCopy(copy) : { rev };
    }
    const latest = await ctx.copies?.latest(fileId, tabId);
    return latest ? baseFromCopy(latest) : undefined;
  }

  // The api's refusal of a write, worded with what to do next; other answers pass through.
  function refusalOf(err: unknown, target: WriteTarget, base: CopyBase | undefined): unknown {
    if (!(err instanceof ApiError)) return err;
    const body = bodyOf(err);
    const since = `since ${base ? `rev ${base.rev}` : 'your read'}${typeof body.rev === 'number' ? ` (now ${body.rev})` : ''}`;
    const reread = `re-read: ${cli} tab view ${JSON.stringify(target.ref)} --tab ${JSON.stringify(target.tabName)}`;
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

  async function submitChangeset<Answer extends ChangesetAnswer>(
    ctx: WriteContext<Tab>,
    target: WriteTarget,
    // The changes: `{ operations }` or `{ replace }`, as the product's api-schema words them.
    body: object,
    flags: WriteFlags,
  ): Promise<Answer> {
    const base = flags.base === null ? undefined : await baseFor(ctx, target, flags.base);
    const request = {
      ...body,
      ...(base ? { base } : {}),
      ...(flags.strict ? { strict: true } : {}),
      ...(flags.summary ? { summary: flags.summary } : {}),
    };
    const path = `/${collection}/${encodeURIComponent(target.fileId)}/tabs/${encodeURIComponent(target.tabId)}/changesets${flags.dryRun ? '?dryRun=1' : ''}`;
    const started = ctx.now();
    let response: Answer;
    for (let attempt = 1; ; attempt += 1) {
      try {
        response = await ctx.api.json<Answer>(path, {
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
      await recordCopy(ctx, target.fileId, target.tabId);
    return response;
  }

  return { writeFlags: writeFlagsOf(summaryMax), submitChangeset };
}
