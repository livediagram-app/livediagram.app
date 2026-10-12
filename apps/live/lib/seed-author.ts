// Who an offline document's example cards are made by (docs/specs/026-plan/plan-templates.md "Example cards"): the
// person making it, as every card they make names them (itemPersonId). A Local only document opens before identity
// settles (docs/specs/006-document/offline-mode.md "Instant open"), so while it is still pending the cards are made
// by the example team's Maya, as they would be by anyone else.
import { itemPersonId, type ItemPerson } from '@livediagram/items';
import type { Participant } from './identity';

export async function seedAuthor(
  self: Pick<Participant, 'id' | 'name' | 'color'>,
): Promise<ItemPerson> {
  if (self.id === 'pending') {
    // Loaded with the cards it makes, never in /new's first load.
    const { seedPerson } = await import('@livediagram/templates/plan-template-seeds');
    return seedPerson('maya');
  }
  return { id: await itemPersonId(self.id), name: self.name, color: self.color };
}
