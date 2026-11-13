// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectionTemplates } from './SectionTemplates';

const Card = ({ template, source }: { template: { kind: string }; source: string }) => (
  <a href={`/new?template=${template.kind}`}>{`${template.kind} ${source}`}</a>
);

describe('SectionTemplates', () => {
  it('lays out the category’s templates under its label and lead', () => {
    render(
      <SectionTemplates
        label="Flowcharts"
        lead="Pick one."
        templates={[{ kind: 'a' }, { kind: 'b' }]}
        Card={Card}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Start from a template' })).toBeTruthy();
    expect(screen.getByText('Flowcharts')).toBeTruthy();
    expect(screen.getByText('Pick one.')).toBeTruthy();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'a Feature.Templates',
      'b Feature.Templates',
    ]);
  });

  it('shows no band for a category with no templates', () => {
    const { container } = render(
      <SectionTemplates label="Empty" lead="None." templates={[]} Card={Card} />,
    );
    expect(container.innerHTML).toBe('');
  });
});
