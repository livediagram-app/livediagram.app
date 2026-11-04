// The room's eye on the calls kill switch (docs/specs/016-platform/calls-kill-switch.md "The room tells its
// clients"). A flip from the command line, or a trip by the budget poll, reaches nobody by itself, so a Space's room
// reads the switch while a call is under way in it: on each `avatar-voice` or `call-track` op it relays, at most once
// per CALLS_MODE_CACHE_MS, and tells every socket when the mode differs from the one it last told. Memory only: a
// room that hibernates starts again from `on`, and its next call op reads the switch afresh.
import type { CallsMode } from '@livehuddle/api-schema';
import { CALLS_MODE_CACHE_MS } from './calls-mode';

export type CallsModeWatchDeps = {
  // The switch (callsMode), which never throws.
  read: () => Promise<CallsMode>;
  // Every socket in the room hears the new mode.
  tell: (mode: CallsMode) => void;
  now?: () => number;
};

export class CallsModeWatch {
  private readonly deps: CallsModeWatchDeps;
  private nextReadAt = 0;
  private told: CallsMode = 'on';

  constructor(deps: CallsModeWatchDeps) {
    this.deps = deps;
  }

  /** A call op passed through the room. One number compare inside the window; a read outside it. */
  note(): Promise<void> | null {
    const now = (this.deps.now ?? Date.now)();
    if (now < this.nextReadAt) return null;
    this.nextReadAt = now + CALLS_MODE_CACHE_MS;
    return this.deps.read().then((mode) => {
      if (mode === this.told) return;
      this.told = mode;
      console.info('[calls] room told', mode);
      this.deps.tell(mode);
    });
  }
}
