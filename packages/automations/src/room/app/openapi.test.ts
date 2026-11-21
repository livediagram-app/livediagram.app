import { describe, expect, it } from 'vitest';
import {
  AUTOMATION_SCHEMA_ROOTS,
  AUTOMATIONS_TAG,
  automationsTagDescription,
  itemAutomationOperations,
} from './openapi';

describe('the manifest’s Automations operations', () => {
  const ops = itemAutomationOperations({ collection: 'documents', itemWord: 'document' });

  it('lists the thirteen routes under the app’s collection and the two public doors', () => {
    expect(ops).toHaveLength(15);
    expect(ops.every((o) => o.tag === AUTOMATIONS_TAG)).toBe(true);
    const under = ops.filter((o) => o.segment === 'documents');
    expect(under).toHaveLength(13);
    expect(under.every((o) => o.path.startsWith('/documents/{id}/automations'))).toBe(true);
    expect(ops.filter((o) => o.auth === 'public').map((o) => o.path)).toEqual([
      '/hooks/automations/{documentId}/{ruleId}',
      '/email-optout/{documentId}/{token}',
    ]);
  });

  it('says who may call, in the app’s word', () => {
    const list = ops[0]!;
    expect(list.summary).toContain("The document's rules");
    expect(list.summary).toContain('edit access to the whole document');
    const secret = ops.find((o) => o.path.endsWith('/secret'))!;
    expect(secret.tokenUsable).toBeUndefined();
    expect(ops.find((o) => o.path.endsWith('/summary'))!.auth).toBe('guest-or-clerk');
    expect(automationsTagDescription('design')).toContain('Rules a design runs');
  });

  it('names every body schema it roots, and takes another word and id name', () => {
    const named = new Set(ops.flatMap((o) => [o.requestSchema, o.responseSchema]).filter(Boolean));
    expect([...named].sort()).toEqual([...AUTOMATION_SCHEMA_ROOTS].sort());
    const spaces = itemAutomationOperations({
      collection: 'spaces',
      itemWord: 'Space',
      itemParam: 'id',
    });
    expect(spaces[0]!.path).toBe('/spaces/{id}/automations');
    expect(spaces[13]!.path).toBe('/hooks/automations/{id}/{ruleId}');
    expect(itemAutomationOperations({ collection: 'spaces', itemWord: 'Space' })[14]!.path).toBe(
      '/email-optout/{spaceId}/{token}',
    );
  });
});
