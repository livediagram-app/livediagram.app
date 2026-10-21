import { describe, expect, it } from 'vitest';
import { itemPersonId } from '@liveplanner/items';
import { seedAuthor } from './seed-author';

// docs/specs/026-plan/plan-templates.md "Example cards": an offline document's example cards are made by the person
// making it, as their own cards name them, or by the example team's Maya while identity is still settling.
describe('seedAuthor', () => {
  it('names the person making the document by their item person id', async () => {
    const by = await seedAuthor({ id: 'guest-123456', name: 'Tom', color: '#2563eb' });
    expect(by).toEqual({ id: await itemPersonId('guest-123456'), name: 'Tom', color: '#2563eb' });
  });

  it('falls back to the example team while identity is pending', async () => {
    const by = await seedAuthor({ id: 'pending', name: '', color: '#000000' });
    expect(by.id).toBe('example-maya');
    expect(by.name).toBe('Maya Chen');
    // The example team loads lazily (the seeds' module): its first, cold transform can be slow under load.
  }, 30_000);
});
