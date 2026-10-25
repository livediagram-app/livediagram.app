// The subrequest budget (liveworkspace/docs/drive.md "Limits and cost"): one meter per pass or per call to the
// object, charged before every request to Google, the index or an app's door, so no invocation goes past
// DRIVE_PASS_SUBREQUEST_BUDGET. The inbound and outbound loops ask `afford` before each step and stop cleanly; a
// charge past the budget throws BudgetSpent, which ends the pass as a batch to continue, never as a failure.

import { DRIVE_PASS_SUBREQUEST_BUDGET } from '@liveworkspace/drive';
import type { AppDoors } from '../app-doors';

export class BudgetSpent extends Error {
  constructor() {
    super('drive: subrequest budget spent');
    this.name = 'BudgetSpent';
  }
}

/** What a request site needs: a charge before each request. */
export interface Charge {
  charge(count?: number): void;
}

export class SubrequestMeter implements Charge {
  readonly budget: number;
  used = 0;
  // The most this meter ever reached (tests).
  peak = 0;

  constructor(budget = DRIVE_PASS_SUBREQUEST_BUDGET) {
    this.budget = budget;
  }

  get remaining(): number {
    return this.budget - this.used;
  }

  /** Whether `count` more requests fit. */
  afford(count: number): boolean {
    return this.used + count <= this.budget;
  }

  charge(count = 1): void {
    if (!this.afford(count)) throw new BudgetSpent();
    this.used += count;
    this.peak = Math.max(this.peak, this.used);
  }
}

/** `doFetch`, charging `meter` before each request. */
export function meteredFetch(doFetch: typeof fetch, meter: Charge): typeof fetch {
  return (input, init) => {
    meter.charge();
    return doFetch(input, init);
  };
}

/** The apps' doors, charging `meter` for each request (`itemUrl` makes none). */
export function meteredDoors(doors: AppDoors, meter: Charge): AppDoors {
  return {
    exportFile: (app, id) => (meter.charge(), doors.exportFile(app, id)),
    exportSvg: (app, id) => (meter.charge(), doors.exportSvg(app, id)),
    importFile: (app, input) => (meter.charge(), doors.importFile(app, input)),
    itemUrl: (app, id) => doors.itemUrl(app, id),
  };
}
