// The avatar fan-out probe's driver (README.md beside this file): walks N characters through one room on the probe
// Worker and reports what the room relayed and what its workerd process spent doing it.
//
//   node drive.mjs <walkers> <workerd pid>
//
// PROBE_EVERY: the client's send interval in ms, or `auto` for the editors' stepped cadence (default 33).
// PROBE_BATCHES=0: clients that do not take batched frames. PROBE_TABS: how many tabs the walkers spread over.
// PROBE_TALK=1: every walker also talks the whole time, a new `avatar-voice` level every 250 ms, proximity audio's
// ceiling (docs/specs/012-collaboration/proximity-audio.md "The wire").
// PROBE_LEAN=0: editors from before lean avatar packets, every packet carrying the costume and its resting values
// (docs/specs/008-canvas/avatar-mode.md "The costume rides only when it is needed").
// The sockets are spread over PROBE_THREADS threads (default 6), so the driver keeps up with what the room sends.
import { execFileSync } from 'node:child_process';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

// The editors' stepped cadence (@livehuddle/avatar/relay `avatarSendIntervalMs`), mirrored so the driver needs
// no build step: the room holds `walkers` connections.
const stepped = (n) => (n <= 10 ? 33 : n <= 32 ? 50 : 66);
// The costume's refresh (@livehuddle/avatar/wire `AVATAR_COSTUME_REFRESH_MS`), mirrored the same way.
const COSTUME_REFRESH_MS = 2000;

if (isMainThread) {
  const walkers = Number(process.argv[2] ?? 10);
  const pid = process.argv[3];
  const seconds = Number(process.env.PROBE_SECONDS ?? 10);
  const cadence = process.env.PROBE_EVERY ?? '33';
  const every = cadence === 'auto' ? stepped(walkers) : Number(cadence);
  const threads = Math.min(walkers, Number(process.env.PROBE_THREADS ?? 6));
  const shared = {
    port: process.env.PROBE_PORT ?? '3620',
    room: `probe-${walkers}-${Date.now()}`,
    every,
    batches: process.env.PROBE_BATCHES !== '0',
    tabs: Number(process.env.PROBE_TABS ?? 1),
    talk: process.env.PROBE_TALK === '1',
    lean: process.env.PROBE_LEAN !== '0',
  };
  // The workerd process's CPU time so far (user + system), in seconds.
  const cpuSeconds = () => {
    const out = execFileSync('ps', ['-o', 'time=', '-p', pid]).toString().trim();
    const [m, s] = out.split(':');
    return Number(m) * 60 + Number(s);
  };
  const workers = Array.from({ length: threads }, (_, t) => {
    const ids = [];
    for (let i = t; i < walkers; i += threads) ids.push(i);
    return new Worker(new URL(import.meta.url), { workerData: { ...shared, ids } });
  });
  const ask = (w, msg) =>
    new Promise((resolve) => {
      w.once('message', resolve);
      w.postMessage(msg);
    });
  await Promise.all(workers.map((w) => ask(w, 'open')));
  await Promise.all(workers.map((w) => ask(w, 'walk')));
  await new Promise((r) => setTimeout(r, 2000));
  await Promise.all(workers.map((w) => ask(w, 'count')));
  const cpu0 = cpuSeconds();
  const t0 = Date.now();
  await new Promise((r) => setTimeout(r, seconds * 1000));
  const counts = await Promise.all(workers.map((w) => ask(w, 'stop')));
  const cpu1 = cpuSeconds();
  const elapsed = (Date.now() - t0) / 1000;
  const sum = (k) => counts.reduce((n, c) => n + c[k], 0);
  console.log(
    JSON.stringify({
      walkers,
      everyMs: every,
      tabs: shared.tabs,
      batches: shared.batches,
      talking: shared.talk,
      lean: shared.lean,
      sentPerSecond: Math.round((walkers * 1000) / every),
      framesPerSecond: Math.round(sum('frames') / elapsed),
      opsPerSecond: Math.round(sum('ops') / elapsed),
      kbPerSecond: Math.round(sum('bytes') / elapsed / 1024),
      workerdCpuPercent: Math.round(((cpu1 - cpu0) / elapsed) * 100),
    }),
  );
  for (const w of workers) await w.terminate();
} else {
  const { port, room, every, batches, tabs, talk, lean, ids } = workerData;
  const costume = { gender: 'female', clothing: 'hoodie', hair: 'bun', size: 'regular' };
  // One walker's character this step: the full packet every editor sent before, or the lean one
  // (@livehuddle/avatar/wire `leanAvatarPacket`): the position to a hundredth of a px, the resting values
  // left out, and the costume on the first packet and every COSTUME_REFRESH_MS after.
  const character = (x, y, stepFrame, withCostume) =>
    lean
      ? {
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
          facing: 'right',
          walking: true,
          ...(stepFrame ? { stepFrame } : {}),
          ...(withCostume ? { config: costume } : {}),
        }
      : {
          x,
          y,
          facing: 'right',
          config: costume,
          walking: true,
          stepFrame,
          lift: 0,
          wave: null,
          seatedOn: null,
          holding: null,
        };
  const counts = { frames: 0, ops: 0, bytes: 0 };
  let counting = false;
  const sockets = [];
  const timers = [];
  // How many relayed ops a frame holds: one, or a batch's count, without parsing the whole frame.
  const opsOf = (data) => {
    if (!data.startsWith('{"kind":"batch"')) return data.startsWith('{"kind":"op"') ? 1 : 0;
    let n = 0;
    for (
      let at = data.indexOf('{"kind":"op"', 1);
      at !== -1;
      at = data.indexOf('{"kind":"op"', at + 1)
    )
      n++;
    return n;
  };
  const open = () =>
    Promise.all(
      ids.map((i) => {
        const role = talk ? '&role=participate' : '';
        const ws = new WebSocket(`ws://127.0.0.1:${port}/?room=${room}${role}`);
        sockets.push([i, ws]);
        ws.addEventListener('message', (e) => {
          if (!counting || typeof e.data !== 'string') return;
          counts.frames++;
          counts.bytes += e.data.length;
          counts.ops += opsOf(e.data);
        });
        return new Promise((resolve, reject) => {
          ws.addEventListener('open', () => {
            ws.send(
              JSON.stringify({
                kind: 'hello',
                participant: { name: `Walker ${i}`, color: '#0ea5e9', tabId: `t${i % tabs}` },
                ...(batches ? { batches: true } : {}),
                ...(lean ? { leanAvatars: true } : {}),
              }),
            );
            resolve();
          });
          ws.addEventListener('error', reject);
        });
      }),
    );
  const walk = () => {
    let step = 0;
    for (const [i, ws] of sockets) {
      let costumeAt = -Infinity;
      timers.push(
        setTimeout(() => {
          timers.push(
            setInterval(() => {
              step++;
              const now = Date.now();
              const withCostume = now - costumeAt >= COSTUME_REFRESH_MS;
              if (withCostume) costumeAt = now;
              ws.send(
                JSON.stringify({
                  kind: 'op',
                  op: {
                    kind: 'avatar',
                    tabId: `t${i % tabs}`,
                    avatar: character(
                      400 + (step % 200) * 8.7,
                      300 + i * 10,
                      step % 2,
                      withCostume,
                    ),
                  },
                }),
              );
            }, every),
          );
          if (talk) {
            let level = 0;
            timers.push(
              setInterval(() => {
                level = (level % 4) + 1;
                ws.send(
                  JSON.stringify({
                    kind: 'op',
                    op: { kind: 'avatar-voice', tabId: `t${i % tabs}`, level },
                  }),
                );
              }, 250),
            );
          }
        }, Math.random() * every),
      );
    }
  };
  parentPort.on('message', async (msg) => {
    if (msg === 'open') await open();
    if (msg === 'walk') walk();
    if (msg === 'count') counting = true;
    if (msg === 'stop') {
      counting = false;
      for (const t of timers) clearInterval(t);
      for (const [, ws] of sockets) ws.close();
    }
    parentPort.postMessage(counts);
  });
}
