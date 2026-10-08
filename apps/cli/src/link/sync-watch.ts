// `sync --watch` (docs/specs/027-repositories/repository-link.md "Commands"; blueprint "`sync --watch`"): one full
// pass, then one room stream per covered document and a watch on the mirror directory. A document's burst of room
// changes settles for WAIT_SETTLE_MS (RL20), a file's for SYNC_LOCAL_SETTLE_MS, then a pass narrowed to it runs;
// passes run one at a time, merged per document. Coverage is read again every SYNC_WATCH_COVERAGE_MS (RL21). One
// line per pass (RL25); Ctrl-C ends it, exit 0. The lock is held per pass, never between passes (RL19).

import { posix } from 'node:path';
import type { VerbContext } from '@livediagram/agent-verbs';
import { WAIT_SETTLE_MS } from '../commands/wait';
import { debugLog } from '../debug';
import type { CliIo } from '../io';
import { formatError } from '../output/cli-error';
import { EXIT, type ExitCode } from '../output/exit-codes';
import { failureOf } from '../output/failure-of';
import { classifyRoomOp } from '../room/room-events';
import { openRoomStream, type RoomStream } from '../room/room-stream';
import { parsePullFile, PULL_FILE_SUFFIX, sha256 } from '../sync/pull-file';
import { SYNC_LOCAL_SETTLE_MS, SYNC_WATCH_COVERAGE_MS } from './constants';
import { readCoverage, type Coverage } from './coverage';
import type { LinkFile } from './link-file';
import { runSyncPass, type PassResult } from './sync-run';

export type WatchOptions = {
  io: CliIo;
  // Its log prints `[sync] …`.
  ctx: VerbContext;
  link: LinkFile;
  host: string;
  apiBase: string;
  relocate: boolean;
  command: string;
};

type Scope = { documents: Set<string>; paths: Set<string> };

// `<HH:MM:SS>` in UTC.
const clock = (ms: number) => new Date(ms).toISOString().slice(11, 19);

export function watchLink(options: WatchOptions): Promise<ExitCode> {
  const { io, ctx, link, host } = options;
  const base = posix.join(link.root, link.mirror.dir);
  let coverage: Coverage;
  const streams = new Map<string, RoomStream>();
  const timers = new Map<string, () => void>();
  const touched = new Map<string, string | null>();
  // The document each mirror file held at the last pass, so a deleted one is written again.
  const known = new Map<string, string>();
  let shown = new Set<string>();
  let pending: Scope = { documents: new Set(), paths: new Set() };
  let running: Promise<void> | null = null;
  let stopped = false;
  const cleanups: (() => void)[] = [];

  // One line per pass; a refusal or report line again only after it changed.
  const print = (result: PassResult, full: boolean) => {
    const acted = result.lines.slice(0, -1);
    const repeated = (line: string) => /^[!?] /.test(line) && shown.has(line);
    const fresh = acted.filter((line) => !repeated(line));
    const reported = acted.filter((line) => /^[!?] /.test(line));
    shown = full ? new Set(reported) : new Set([...shown, ...reported]);
    io.stdout(`${clock(io.now())} ${fresh.length > 0 ? fresh.join(' · ') : 'in step'}\n`);
    for (const [path, hash] of result.touched) touched.set(path, hash);
    for (const [path, id] of result.mirrors) known.set(path, id);
  };

  const pass = async (scope: Scope | null, fresh?: Coverage) => {
    const result = await runSyncPass({
      ...options,
      dryRun: false,
      coverage: fresh ?? coverage,
      scope,
    });
    coverage = result.coverage;
    print(result, scope === null);
  };

  const drain = async () => {
    while (!stopped && (pending.documents.size > 0 || pending.paths.size > 0)) {
      const scope = pending;
      pending = { documents: new Set(), paths: new Set() };
      try {
        await pass(scope);
      } catch (err) {
        io.stderr(formatError(failureOf(err, host), false));
      }
    }
    running = null;
  };

  const due = (scope: Partial<Scope>) => {
    scope.documents?.forEach((id) => pending.documents.add(id));
    scope.paths?.forEach((p) => pending.paths.add(p));
    running ??= drain();
  };

  const settle = (key: string, ms: number, then: () => void) => {
    timers.get(key)?.();
    timers.set(
      key,
      io.timer(ms, () => {
        timers.delete(key);
        then();
      }),
    );
  };

  const listen = (documentId: string) => {
    const stream = openRoomStream({
      io,
      api: ctx.api,
      apiBase: options.apiBase,
      documentId,
      log: debugLog(io),
      notice: ctx.notice,
      onOp: (op) => {
        if (classifyRoomOp(op).length === 0) return;
        settle(`room ${documentId}`, WAIT_SETTLE_MS, () => {
          ctx.log(`watch room ${documentId} settled`);
          due({ documents: new Set([documentId]) });
        });
      },
      onReconnected: () => due({ documents: new Set([documentId]) }),
    });
    streams.set(documentId, stream);
    // Moved to the Trash, or its ticket refused: a pass decides `gone` or `unreadable`, and the stream is dropped.
    const drop = () => {
      streams.delete(documentId);
      due({ documents: new Set([documentId]) });
    };
    stream.ended.then((end) => (end === 'trashed' ? drop() : undefined), drop);
  };

  // A file event settles first; then a file that holds what the watch itself wrote, or is gone as the watch removed
  // it, is its own write (RL23). Judged once settled, since an event can come before its pass has said what it wrote.
  const onLocal = (path: string) => {
    if (!path.endsWith(PULL_FILE_SUFFIX)) return;
    settle(`local ${path}`, SYNC_LOCAL_SETTLE_MS, () => {
      void io.files.read(path).then(async (text) => {
        const hash = text === null ? null : await sha256(text);
        if (touched.has(path) && touched.get(path) === hash) return;
        ctx.log('watch local settled');
        const rel = posix.relative(base, path);
        const parsed = text === null ? null : parsePullFile(text);
        due({
          paths: new Set([rel]),
          documents: new Set(
            parsed?.ok ? [parsed.file.document.id] : known.has(rel) ? [known.get(rel)!] : [],
          ),
        });
      });
    });
  };

  const recover = () => {
    cleanups.push(
      io.timer(SYNC_WATCH_COVERAGE_MS, () => {
        void readCoverage(ctx, link).then(
          (fresh) => {
            ctx.log('watch coverage settled');
            const before = new Set(coverage.documents.map((d) => d.id));
            const after = new Set(fresh.documents.map((d) => d.id));
            const entered = [...after].filter((id) => !before.has(id));
            const left = [...before].filter((id) => !after.has(id));
            coverage = fresh;
            // Every covered document without a stream gets one: those that entered, and any whose stream ended
            // (trashed then restored, refused, dropped), so a change never waits on a later pass to be noticed.
            const unheard = [...after].filter((id) => !streams.has(id) && !entered.includes(id));
            if (unheard.length > 0) ctx.log(`watch relisten ${unheard.length}`);
            [...entered, ...unheard].forEach(listen);
            for (const id of left) {
              streams.get(id)?.stop();
              streams.delete(id);
            }
            if (entered.length + left.length > 0)
              due({ documents: new Set([...entered, ...left]) });
            if (!stopped) recover();
          },
          (err: unknown) => {
            io.stderr(formatError(failureOf(err, host), false));
            if (!stopped) recover();
          },
        );
      }),
    );
  };

  return new Promise<ExitCode>((resolve, reject) => {
    // The first pass runs to its end whatever comes, and so does the pass under way when Ctrl-C comes.
    const first = pass(null);
    const stop = () => {
      stopped = true;
      streams.forEach((s) => s.stop());
      timers.forEach((cancel) => cancel());
      cleanups.forEach((c) => c());
      void Promise.allSettled([first, running]).then(() => resolve(EXIT.done));
    };
    cleanups.push(io.onInterrupt(stop));
    first.then(
      async () => {
        if (stopped) return;
        if (link.mirror.level === 'none') return stop();
        coverage.documents.forEach((d) => listen(d.id));
        await io.files.mkdir(base);
        cleanups.push(io.watchTree(base, onLocal));
        recover();
      },
      (err: unknown) => {
        stopped = true;
        cleanups.forEach((c) => c());
        reject(err);
      },
    );
  });
}
