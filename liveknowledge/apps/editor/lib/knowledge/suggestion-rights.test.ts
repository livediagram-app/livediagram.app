import { describe, expect, it } from 'vitest';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { suggestionRights } from './suggestion-rights';

// docs/specs/030-knowledgebase/ai-knowledge.md "Share roles": see for everyone, decide for an Editor.
const rights = (level: 'edit' | 'participate' | 'view', over = {}) =>
  suggestionRights({
    can: resolveEditorCapabilities(level),
    isStructureReadOnly: false,
    offline: false,
    ...over,
  });

describe('who may decide a suggested edit', () => {
  it('lets an Editor accept and dismiss', () => {
    expect(rights('edit')).toEqual({ see: true, decide: true });
  });

  it.each(['participate', 'view'] as const)('lets a %s session see and decide nothing', (level) => {
    expect(rights(level)).toEqual({ see: true, decide: false });
  });

  it('gives an Editor through a link confined to one page nothing to decide', () => {
    expect(rights('edit', { isStructureReadOnly: true }).decide).toBe(false);
  });

  it('shows none in a knowledgebase kept Offline', () => {
    expect(rights('edit', { offline: true })).toEqual({ see: false, decide: false });
  });
});
