import { describe, expect, it } from 'vitest';
import { parseEditOperations } from '@liveplanner/edit-operations';
import { argvToOperationLine } from '@liveworkspace/agent-verbs/argv-line';

// The shared suite covers the words; this one parses them back with this product's edit operations.
describe('the line it writes', () => {
  it('parses back to the words it was given', () => {
    const line = argvToOperationLine('set', ['w1', 'label=Say "hi" \\ there', 'textSize=lg']);
    const parsed = parseEditOperations(line);
    expect(parsed).toHaveProperty('operations');
    expect(JSON.stringify(parsed)).toContain('Say \\"hi\\" \\\\ there');
    expect(parseEditOperations(argvToOperationLine('rm', ['label~Sign in']))).toHaveProperty(
      'operations',
    );
  });
});
