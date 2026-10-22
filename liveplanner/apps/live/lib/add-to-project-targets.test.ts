import { describe, expect, it, vi } from 'vitest';
import { addToProjectTargets } from './add-to-project-targets';

vi.mock('@/lib/offline/offline-store', () => ({ OFFLINE_OWNER_ID: 'offline' }));

const docs = [
  { id: 'here', ownerId: 'me' },
  { id: 'roadmap', ownerId: 'me' },
  { id: 'local', ownerId: 'offline' },
];
const base = {
  projectId: 'here',
  projectList: docs,
  isOffline: false,
  workbench: false,
  isOwner: true,
};

describe('addToProjectTargets', () => {
  it("offers the owner's other online projects", () => {
    expect(addToProjectTargets(base).map((d) => d.id)).toEqual(['roadmap']);
  });

  it("offers nothing on a project you don't own, where the link would be refused", () => {
    expect(addToProjectTargets({ ...base, isOwner: false })).toEqual([]);
  });

  it('offers nothing in an offline project or a workbench', () => {
    expect(addToProjectTargets({ ...base, isOffline: true })).toEqual([]);
    expect(addToProjectTargets({ ...base, workbench: true })).toEqual([]);
  });
});
