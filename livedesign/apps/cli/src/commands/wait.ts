// `wait <doc> --for comment|change` (docs/specs/015-api/blueprints/cli.md "The room stream", CLI33, CLI80): listens
// until a comment is added, or until a change settles for WAIT_SETTLE_MS, then prints it. `--timeout` ends with a
// line saying nothing came; Ctrl-C ends with exit 1; the design moved to the Trash with exit 3.

import { designOf, resolveTab, tabPath, type VerbContext } from '@livedesign/agent-verbs';
import { revOfEtag, type DesignCommentsResponse } from '@livedesign/api-schema';
import { threadListingLines } from '@livedesign/design-views';
import type { CliIo } from '../io';
import { CliError } from '../output/cli-error';
import { EXIT } from '@liveworkspace/cli-kit/exit-codes';
import { classifyRoomOp, onTab, type RoomEvent } from '../room/room-events';
import { openRoomStream } from '../room/room-stream';
import { oneLine } from '@liveworkspace/cli-kit/one-line';

export const WAIT_SETTLE_MS = 2_000;

export type WaitInput = { doc: string; for: 'comment' | 'change'; tab?: string; timeout?: number };
export type StreamResult = { lines: string[]; exit: number };

export const trashedError = () =>
  new CliError({
    exit: EXIT.notFound,
    code: 'trashed',
    message: 'the design was moved to the Trash',
    hint: 'livedesign design restore <doc>',
  });

const quoted = (text: string) => JSON.stringify(text);

// The thread a new comment landed in, as `comment ls` prints it; the comment alone when the thread is gone.
async function commentLines(
  ctx: VerbContext,
  designId: string,
  event: Extract<RoomEvent, { kind: 'comment' }>,
): Promise<string[]> {
  const { threads } = await ctx.api.json<DesignCommentsResponse>(
    `/designs/${encodeURIComponent(designId)}/comments?status=all`,
  );
  const thread = threads.find((t) => t.tabId === event.tabId && t.elementId === event.elementId);
  return thread
    ? threadListingLines(thread)
    : [
        `comment on ${oneLine(event.elementId)} by ${oneLine(event.authorName)}: ${quoted(event.text)}`,
      ];
}

// `tab "<name>" changed · rev <a>→<b> · diff: …`, `<a>` the latest read copy's revision; without one, the hint
// is left out (CLI33).
async function changeLines(
  ctx: VerbContext,
  input: WaitInput,
  design: { id: string; tabs: { id: string; name: string }[] },
  event: RoomEvent,
): Promise<string[]> {
  if (event.kind === 'design') return [`design ${quoted(event.name)} changed`];
  const name = design.tabs.find((t) => t.id === event.tabId)?.name ?? event.tabId;
  const { etag } = await ctx.api.text(tabPath(design.id, event.tabId));
  const now = revOfEtag(etag);
  const read = (await ctx.copies?.latest(design.id, event.tabId))?.rev;
  if (now === null) return [`tab ${quoted(name)} changed`];
  const head = `tab ${quoted(name)} changed · rev `;
  if (read === undefined || read === now) return [`${head}${now}`];
  return [
    `${head}${read}→${now} · diff: livedesign tab diff ${quoted(input.doc)} --tab ${quoted(name)} --since ${read}`,
  ];
}

export async function waitFor(
  io: CliIo,
  ctx: VerbContext,
  apiBase: string,
  input: WaitInput,
): Promise<StreamResult> {
  const design = await designOf(ctx, input.doc);
  const tabId =
    input.tab === undefined ? null : resolveTab(design.tabs, input.tab, input.doc, ctx.log).id;
  return new Promise<StreamResult>((resolve, reject) => {
    let first: RoomEvent | null = null;
    let cancelSettle: (() => void) | null = null;
    // Set by the first ending; every timer and listener that could end it again is cancelled with it.
    let done = false;
    const cleanups: (() => void)[] = [];
    const finish = (result: Promise<StreamResult> | StreamResult) => {
      done = true;
      cancelSettle?.();
      cleanups.forEach((c) => c());
      stream.stop();
      Promise.resolve(result).then(resolve, reject);
    };
    const stream = openRoomStream({
      io,
      api: ctx.api,
      apiBase,
      designId: design.id,
      log: ctx.log,
      notice: ctx.notice,
      onOp: (op) => {
        for (const event of classifyRoomOp(op)) {
          if (done || !onTab(event, tabId)) continue;
          ctx.log(`room event ${event.kind}`);
          if (input.for === 'comment' && event.kind === 'comment')
            return finish(
              commentLines(ctx, design.id, event).then((lines) => ({ lines, exit: EXIT.done })),
            );
          if (input.for === 'change' && event.kind !== 'comment') {
            first ??= event;
            cancelSettle?.();
            const settled = first;
            cancelSettle = io.timer(WAIT_SETTLE_MS, () =>
              finish(
                changeLines(ctx, input, design, settled).then((lines) => ({
                  lines,
                  exit: EXIT.done,
                })),
              ),
            );
          }
        }
      },
      onReconnected: () =>
        ctx.notice(
          `reconnected; what changed meanwhile: livedesign tab diff ${quoted(input.doc)}`,
        ),
    });
    stream.ended.then(
      (end) => {
        if (end === 'trashed') {
          done = true;
          cancelSettle?.();
          cleanups.forEach((c) => c());
          reject(trashedError());
        }
      },
      (err: unknown) => {
        done = true;
        cleanups.forEach((c) => c());
        reject(err);
      },
    );
    cleanups.push(io.onInterrupt(() => finish({ lines: [], exit: EXIT.rejected })));
    if (input.timeout !== undefined) {
      const seconds = input.timeout;
      cleanups.push(
        io.timer(seconds * 1000, () =>
          finish({ lines: [`nothing new in ${seconds} s`], exit: EXIT.done }),
        ),
      );
    }
  });
}
