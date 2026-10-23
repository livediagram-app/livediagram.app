// `watch <doc>` (docs/specs/015-api/blueprints/cli.md "The room stream", CLI33): a line for each event the room
// relays, as it happens, until Ctrl-C (exit 0); the design moved to the Trash ends it with exit 3. Element refs are
// the views' refs: a tab's ids are read once, on its first event, and kept current from the events.

import { designOf, resolveTab, tabPath, type VerbContext } from '@livedesign/agent-verbs';
import { computeRefs, type Tab } from '@livedesign/design';
import type { CliIo } from '../io';
import { EXIT } from '../output/exit-codes';
import { classifyRoomOp, onTab, watchLines, type Names, type RoomEvent } from '../room/room-events';
import { openRoomStream } from '../room/room-stream';
import { trashedError, type StreamResult } from './wait';

export type WatchInput = { doc: string; tab?: string };

export async function watch(
  io: CliIo,
  ctx: VerbContext,
  apiBase: string,
  input: WatchInput,
  json: boolean,
): Promise<StreamResult> {
  const design = await designOf(ctx, input.doc);
  const tabId =
    input.tab === undefined ? null : resolveTab(design.tabs, input.tab, input.doc, ctx.log).id;
  let tabs = design.tabs.map((t) => ({ id: t.id, name: t.name }));
  let designName = design.name;
  const ids = new Map<string, string[]>();

  // A tab's element ids, read on its first event; a tab that cannot be read names its elements by id.
  const idsOf = async (id: string) => {
    if (!ids.has(id)) {
      const read = await ctx.api
        .json<{ tab: Tab }>(tabPath(design.id, id))
        .then(({ tab }) => tab.elements.map((el) => el.id))
        .catch((err: unknown) => {
          ctx.log(`watch tab unread ${id} ${String(err)}`);
          return [];
        });
      ids.set(id, read);
    }
    return ids.get(id)!;
  };

  const names = (known: string[]): Names => ({
    tabName: (id) => tabs.find((t) => t.id === id)?.name ?? id,
    refOf: (_tab, elementId) =>
      computeRefs(known.includes(elementId) ? known : [...known, elementId]).refOf(elementId),
    tabs,
    designName,
  });

  const print = async (event: RoomEvent) => {
    const known = event.kind === 'design' ? [] : await idsOf(event.tabId);
    const lines = json ? [JSON.stringify(event)] : watchLines(event, names(known));
    for (const line of lines) io.stdout(`${line}\n`);
    if (event.kind === 'element' && event.change === 'added' && !known.includes(event.elementId))
      known.push(event.elementId);
    if (event.kind === 'element' && event.change === 'removed')
      ids.set(
        event.tabId,
        known.filter((id) => id !== event.elementId),
      );
    if (event.kind === 'design') {
      tabs = event.tabs;
      designName = event.name;
    }
  };

  return new Promise<StreamResult>((resolve, reject) => {
    // Lines go out in the order the room sent them, though a tab's first event waits for its ids.
    let queue: Promise<void> = Promise.resolve();
    const stream = openRoomStream({
      io,
      api: ctx.api,
      apiBase,
      designId: design.id,
      log: ctx.log,
      notice: ctx.notice,
      onOp: (op) => {
        for (const event of classifyRoomOp(op)) {
          if (!onTab(event, tabId)) continue;
          queue = queue.then(() => print(event));
        }
      },
      onReconnected: () =>
        ctx.notice(
          `reconnected; what changed meanwhile: livedesign tab diff ${JSON.stringify(input.doc)}`,
        ),
    });
    const stopInterrupt = io.onInterrupt(() => {
      stream.stop();
      void queue.then(() => resolve({ lines: [], exit: EXIT.done }));
    });
    stream.ended.then(
      (end) => {
        stopInterrupt();
        if (end === 'trashed') void queue.then(() => reject(trashedError()));
      },
      (err: unknown) => {
        stopInterrupt();
        reject(err);
      },
    );
  });
}
