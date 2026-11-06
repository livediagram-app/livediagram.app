# Avatar fan-out probe

Walks any number of characters through one real `DocumentRoom` on a local workerd and reports what the room relayed
and the CPU its workerd process spent ([Avatar mode](../../../../docs/specs/008-canvas/avatar-mode.md#a-busy-room)).
Local only: the Worker names no account and is never deployed.

1. Start the probe Worker from this folder, on a port of your own:

   ```sh
   ../../node_modules/.bin/wrangler dev --port 3620 --inspector-port 3621
   ```

2. Find the workerd process that runs the Durable Object. `wrangler dev` starts two: the one listening on the port
   is a proxy; the room runs in the other, its sibling under the same parent (`ps -o pid,ppid,time,comm -A | grep
workerd`).

3. Walk, for each room size:

   ```sh
   PROBE_EVERY=auto node drive.mjs 100 <room workerd pid>
   ```

   `PROBE_EVERY` is the client's send interval in ms (`33` was every editor's before the bound, `auto` is the stepped
   cadence), `PROBE_TALK=1` makes every walker talk the whole time as well (a new `avatar-voice` level every 250 ms,
   [Proximity audio](../../../../docs/specs/012-collaboration/proximity-audio.md#the-talking-equaliser)'s ceiling),
   `PROBE_BATCHES=0` makes the clients editors that do not take batches, `PROBE_LEAN=0` editors from before lean avatar
   packets (every packet carrying the costume, [A busy room](../../../../docs/specs/008-canvas/avatar-mode.md#a-busy-room)), `PROBE_TABS` spreads the walkers
   over several tabs and `PROBE_SECONDS` sets the measured window (10 by default, after 2 seconds of warm-up).

It prints one line: the packets the walkers sent a second, the frames and relayed ops their sockets received a second,
the bytes, and the room process's CPU as a percentage of one core. A room that cannot keep up shows as ops received
far below `walkers x (walkers - 1)` packets a step, at 100% CPU.
