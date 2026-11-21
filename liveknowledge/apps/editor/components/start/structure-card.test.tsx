// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StructureOutline, structureCard } from './structure-card';

// docs/specs/030-knowledgebase/describe-to-set-up.md "The start screen": a card is the structure, not a page.
describe('structureCard', () => {
  it('names Blank Knowledgebase and Describe to Set Up, and a structure with its page count', () => {
    expect(structureCard('blank')).toMatchObject({ name: 'Blank Knowledgebase', tag: '1 Page' });
    expect(structureCard('describe').name).toBe('Describe to Set Up');
    expect(structureCard('onboarding')).toMatchObject({ name: 'Onboarding', tag: '11 Pages' });
  });

  it('draws the outline', () => {
    const { container } = render(<>{structureCard('team-handbook').picture}</>);
    expect(container.textContent).toContain('How We Work: Meetings, Communication, Decisions');
    expect(render(<StructureOutline id="nope" />).container.textContent).toBe('');
  });
});
