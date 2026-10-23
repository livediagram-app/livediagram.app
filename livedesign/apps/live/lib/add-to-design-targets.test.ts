import { describe, expect, it, vi } from 'vitest';
import { addToDesignTargets } from './add-to-design-targets';

vi.mock('@/lib/offline/offline-store', () => ({ OFFLINE_OWNER_ID: 'offline' }));

const docs = [
  { id: 'here', ownerId: 'me' },
  { id: 'roadmap', ownerId: 'me' },
  { id: 'local', ownerId: 'offline' },
];
const base = {
  designId: 'here',
  designList: docs,
  isOffline: false,
  workbench: false,
  isOwner: true,
};

describe('addToDesignTargets', () => {
  it("offers the owner's other online designs", () => {
    expect(addToDesignTargets(base).map((d) => d.id)).toEqual(['roadmap']);
  });

  it("offers nothing on a design you don't own, where the link would be refused", () => {
    expect(addToDesignTargets({ ...base, isOwner: false })).toEqual([]);
  });

  it('offers nothing in an offline design or a workbench', () => {
    expect(addToDesignTargets({ ...base, isOffline: true })).toEqual([]);
    expect(addToDesignTargets({ ...base, workbench: true })).toEqual([]);
  });
});
