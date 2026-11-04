// The avatar fan-out probe's driver (README.md beside this file): walks N characters through one room on the probe
// Worker and reports what the room relayed and what its workerd process spent doing it.
//
//   node drive.mjs <walkers> <workerd pid>
//
// PROBE_EVERY: the client's send interval in ms, or `auto` for the editors' stepped cadence (default 33).
// PROBE_BATCHES=0: clients that do not take batched frames. PROBE_TABS: how many tabs the walkers spread over.
// PROBE_TALK=1: every walker also talks the whole time, a new `avatar-voice` level every 250 ms, proximity audio's
// ceiling (docs/specs/012-collaboration/proximity-audio.md "The wire").
// The sockets are spread over PROBE_THREADS threads (default 6), so the driver keeps up with what the room sends.
import { execFileSync } from 'node:child_process';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

// The editors' stepped cadence (@liveworkspace/avatar/relay `avatarSendIntervalMs`), mirrored so the driver needs
// no build step: the room holds `walkers` connections.
const stepped = (n) => (n <= 10 ? 33 : n <= 32 ? 50 : 66);

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
      sentPerSecond: Math.round((walkers * 1000) / every),
      framesPerSecond: Math.round(sum('frames') / elapsed),
      opsPerSecond: Math.round(sum('ops') / elapsed),
      kbPerSecond: Math.round(sum('bytes') / elapsed / 1024),
      workerdCpuPercent: Math.round(((cpu1 - cpu0) / elapsed) * 100),
    }),
  );
  for (const w of workers) await w.terminate();
} else {
  const { port, room, every, batches, tabs, talk, ids } = workerData;
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
      timers.push(
        setTimeout(() => {
          timers.push(
            setInterval(() => {
              step++;
              ws.send(
                JSON.stringify({
                  kind: 'op',
                  op: {
                    kind: 'avatar',
                    tabId: `t${i % tabs}`,
                    avatar: {
                      x: 400 + (step % 200) * 8.7,
                      y: 300 + i * 10,
                      facing: 'right',
                      config: {
                        gender: 'female',
                        clothing: 'hoodie',
                        hair: 'bun',
                        size: 'regular',
                      },
                      walking: true,
                      stepFrame: step % 2,
                      lift: 0,
                      wave: null,
                      seatedOn: null,
                      holding: null,
                    },
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
