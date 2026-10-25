// report.json (docs/migration.md "Tooling"): what the plan found and decided, for the rehearsal's read-through and
// step 9's checks. Lists are capped so a 100k-document report stays readable; every list keeps its full count.
import type { CrossReference } from '@liveworkspace/migration';

const LIST_CAP = 1_000;

export class CappedList<T> {
  readonly items: T[] = [];
  count = 0;
  push(item: T): void {
    this.count++;
    if (this.items.length < LIST_CAP) this.items.push(item);
  }
  toJSON(): object {
    return {
      count: this.count,
      items: this.items,
      ...(this.count > LIST_CAP ? { capped: LIST_CAP } : {}),
    };
  }
}

export class Report {
  readonly counts: Record<string, number> = {};
  readonly notes = new CappedList<{ document: string; note: string }>();
  readonly crossReferences = new CappedList<CrossReference>();
  readonly crossReferenceKinds: Record<string, number> = {};
  readonly droppedHistory: Record<string, number> = {};
  readonly shareCodeCaseCollisions = new CappedList<{
    code: string;
    kept: string;
    document: string;
  }>();
  readonly skipped = new CappedList<{ what: string; id: string; why: string }>();
  readonly imageCollisions = new CappedList<{ image: string; keptImage: string; owner: string }>();
  readonly picturesMissing = new CappedList<{
    document: string;
    tabId: string;
    elementId: string | null;
  }>();

  add(key: string, n = 1): void {
    this.counts[key] = (this.counts[key] ?? 0) + n;
  }

  skip(what: string, id: string, why: string): void {
    this.add(`skipped.${what}`);
    this.skipped.push({ what, id, why });
  }

  crossReference(ref: CrossReference): void {
    this.crossReferences.push(ref);
    this.crossReferenceKinds[ref.kind] = (this.crossReferenceKinds[ref.kind] ?? 0) + 1;
  }

  dropHistory(type: string): void {
    this.droppedHistory[type] = (this.droppedHistory[type] ?? 0) + 1;
  }

  toJSON(): Record<string, unknown> {
    const sorted = (o: Record<string, number>) =>
      Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
    return {
      counts: sorted(this.counts),
      crossReferenceKinds: sorted(this.crossReferenceKinds),
      crossReferences: this.crossReferences,
      droppedHistory: sorted(this.droppedHistory),
      shareCodeCaseCollisions: this.shareCodeCaseCollisions,
      imageCollisions: this.imageCollisions,
      picturesMissing: this.picturesMissing,
      skipped: this.skipped,
      notes: this.notes,
    };
  }
}
