import { describe, expect, it } from 'vitest';
import { isValidTab } from '@livediagram/document';
import { agentBuiltTab } from './__fixtures__/agent-built-tab';
import { edgeCasesTab } from './__fixtures__/edge-cases-tab';
import { golden } from './__fixtures__/golden-path';
import { largeTab } from './__fixtures__/large-tab';
import { estimateTokens } from './budget';
import { buildViewModel } from './model';
import { outlineView } from './outline';

describe('the agent-built tab', () => {
  it('reads with its own slugs as refs, cheaper than prefixes (R7)', async () => {
    const tab = agentBuiltTab();
    expect(isValidTab(tab)).toBe(true);
    const { text } = outlineView(buildViewModel(tab));
    await expect(text).toMatchFileSnapshot(golden('agent-built.outline.txt'));
    expect(text).toContain('→ payments "charge"');
  });
});

describe('the 300-element tab (R20)', () => {
  const model = buildViewModel(largeTab());

  it('fits 2,000 and 200 tokens, saying what it left out', async () => {
    expect(isValidTab(largeTab())).toBe(true);
    expect(model.facts.elements).toBe(300);
    for (const budget of [2000, 200]) {
      const { text } = outlineView(model, { budget });
      expect(estimateTokens(text)).toBeLessThanOrEqual(budget);
      await expect(text).toMatchFileSnapshot(golden(`large.budget-${budget}.txt`));
    }
  });

  it('costs about 12 tokens an element unfitted', () => {
    const { fullTokens } = outlineView(model);
    expect(fullTokens / 300).toBeLessThan(14);
  });
});

describe('the edge-case tab (E2 to E28, R25)', () => {
  it('prints every case, never dropping an unknown kind', async () => {
    const { text, json } = outlineView(buildViewModel(edgeCasesTab()));
    await expect(text).toMatchFileSnapshot(golden('edge-cases.outline.txt'));
    expect(json.header).toMatchObject({ hidden: 2, unknown: 3 });
  });
});
