import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { codeFrom, PendingRequest } from './PairWorkbench';

// The one pairing page (liveworkspace/docs/specs/011-workbench/workbench.md): its code from the address, and its question in the app's
// own words.
describe('the pairing page', () => {
  it('takes a code from the address only when it looks like one', () => {
    expect(codeFrom('?code=abcdefghijklmnopqrstuv')).toBe('abcdefghijklmnopqrstuv');
    expect(codeFrom('?code=short')).toBeNull();
    expect(codeFrom('')).toBeNull();
  });

  const request = {
    origin: 'https://127.0.0.1:5175',
    name: 'Agent',
    tokenName: 'Laptop',
    scope: 'project',
    expiresAt: 0,
    status: 'pending' as const,
    app: 'liveplanner' as const,
  };
  const render = (scope: string) =>
    renderToStaticMarkup(
      <PendingRequest
        step={{ kind: 'pending', request: { ...request, scope }, working: null, failed: false }}
        onAnswer={async () => {}}
      />,
    );

  it("asks for one app's items in its words", () => {
    const html = render('project');
    expect(html).toContain('liveplanner');
    expect(html).toContain('your plans');
    expect(html).toContain('It opens one plan at a time');
    expect(html).toContain('Laptop');
  });

  it('asks for the whole workspace in its own words', () => {
    expect(render('workspace')).toContain('your whole workspace in liveplanner');
  });
});
