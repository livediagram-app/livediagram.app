// What livediagram keeps for a person beside their documents (docs/migration.md, step 1.3): their shape libraries,
// one MigrationPersonPayload per person who had any, for livediagram's person migration door. Owners go through the
// owner map, so a guest folded into an account brings their libraries with them; an account that has no new-side
// account is skipped and reported, as its settings are. Each library keeps its old id and times; the door adds it once
// and never updates it.
import type { MigrationShapeLibrary } from '@liveworkspace/migration';
import type { PlanContext } from './context.ts';
import type { PeopleFiles } from './files.ts';

type Row = Record<string, string | number | null>;

export function writeShapeLibraries(ctx: PlanContext, people: PeopleFiles): void {
  const rows = ctx.snapshot.prepare(
    'SELECT id, owner_id, name, source, items, created_at, updated_at FROM shape_libraries ORDER BY owner_id, created_at, id',
  );
  const byPerson = new Map<string, MigrationShapeLibrary[]>();
  for (const r of rows.iterate() as Iterable<Row>) {
    const oldOwner = String(r.owner_id);
    const person = ctx.owners.ownerOf(oldOwner);
    if (person.startsWith('user_') && !ctx.owners.account(person)) {
      ctx.report.skip('shape_library', String(r.id), 'no account');
      continue;
    }
    let libraries = byPerson.get(person);
    if (!libraries) byPerson.set(person, (libraries = []));
    libraries.push({
      id: String(r.id),
      name: String(r.name),
      source: String(r.source),
      items: String(r.items),
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
    });
    ctx.report.add('shapeLibraries');
  }
  for (const person of [...byPerson.keys()].sort()) {
    people.write({
      v: 1,
      app: 'livediagram',
      personId: person,
      shapeLibraries: byPerson.get(person)!,
    });
  }
}
