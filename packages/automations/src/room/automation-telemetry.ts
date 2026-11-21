// What a wake of an item's Automations did, counted (liveworkspace/docs/specs/018-automations/automations.md
// "Telemetry"). A wake fills one tally and posts it once when it ends, so a busy item is one request a wake however
// many rules ran. Only fixed tokens go in: never a rule's name, a subject or the item. Each app tracks under its own
// item category, with its calls written out where they are made, so the dashboard's emitter scan reads them.
import { TELEMETRY_BATCH_MAX, type TelemetryWireEvent } from '@liveworkspace/telemetry';

// A run's trigger kind, as a type: counted after the results.
export const AUTOMATION_TRIGGER_TYPE_PREFIX = 'AutomationTrigger.';

export class AutomationTally<Category extends string = string, Action extends string = string> {
  // Results and trouble first, the trigger kinds after, so a wake past the batch cap drops the least telling.
  private readonly first: TelemetryWireEvent[] = [];
  private readonly after: TelemetryWireEvent[] = [];

  track(category: Category, action: Action, type: string): void {
    (type.startsWith(AUTOMATION_TRIGGER_TYPE_PREFIX) ? this.after : this.first).push({
      category,
      action,
      type,
    });
  }

  get size(): number {
    return this.first.length + this.after.length;
  }

  // The events so far, at most one batch, emptying the tally, handed to the app's own reporter. Nothing to send
  // sends nothing.
  flush(report: (events: TelemetryWireEvent[]) => Promise<void>): Promise<void> {
    const events = [...this.first, ...this.after].slice(0, TELEMETRY_BATCH_MAX);
    this.first.length = 0;
    this.after.length = 0;
    return events.length ? report(events) : Promise.resolve();
  }
}
