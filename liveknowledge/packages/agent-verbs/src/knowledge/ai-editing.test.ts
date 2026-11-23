import { describe, expect, it } from 'vitest';
import { aiEditingFieldsOf, aiEditingLine } from './ai-editing';

// AI Editing as an agent is told it (docs/specs/030-knowledgebase/ai-editing.md "For agents").
const ALL = ['read', 'suggest', 'write'] as const;

describe('aiEditingFieldsOf', () => {
  it('reads an api that says nothing as Suggest Edits Only', () => {
    expect(aiEditingFieldsOf(undefined, undefined, ALL)).toMatchObject({
      ai_editing: 'suggest',
      ai_edit_unverifies: false,
    });
  });

  it.each([
    ['suggest', true, ALL, 'write_page is refused'],
    ['unverified', true, ALL, 'never-verified page'],
    ['any', true, ALL, 'takes its verification away'],
    ['any', false, ALL, 'they stay verified'],
    ['any', true, ['read', 'suggest'], 'no write scope'],
    ['any', true, ['read'], 'only reads here'],
  ] as const)('%s (unverifies %s) to %j says %s', (level, unverifies, scopes, says) => {
    const fields = aiEditingFieldsOf(level, unverifies, scopes);
    expect(fields.ai_editing_allows).toContain(says);
    // The option is said on only where it is in effect.
    expect(fields.ai_edit_unverifies).toBe(level === 'any' && unverifies);
  });

  it('names the level in one phrase', () => {
    expect(aiEditingLine({ ai_editing: 'suggest', ai_edit_unverifies: false })).toBe(
      'AI Editing: suggest edits only',
    );
    expect(aiEditingLine({ ai_editing: 'unverified', ai_edit_unverifies: false })).toBe(
      'AI Editing: edit unverified pages',
    );
    expect(aiEditingLine({ ai_editing: 'any', ai_edit_unverifies: true })).toBe(
      'AI Editing: edit any page (unverifies it)',
    );
    expect(aiEditingLine({ ai_editing: 'any', ai_edit_unverifies: false })).toBe(
      'AI Editing: edit any page',
    );
  });
});
