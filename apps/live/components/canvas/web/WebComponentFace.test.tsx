// @vitest-environment jsdom

// The web component faces (docs/specs/009-elements/web-components-and-no-groups.md): what an inline edit commits, and the
// rule that a line is only editable once the element is selected (so the first
// press on a component still selects and drags it).

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createComponent, type ShapeElement, type WebRows } from '@livediagram/diagram';

import { WebComponentFace } from './WebComponentFace';

afterEach(cleanup);

const colors = { accent: '#0284c7', surface: '#f0f9ff', ink: '#0c4a6e' };

function renderFace(
  kind: 'stat' | 'process' | 'header' | 'banner',
  opts: { editable?: boolean } = {},
) {
  const element = createComponent(kind, 0, 0, colors) as ShapeElement;
  const onSetRows = vi.fn<(rows: WebRows) => void>();
  const onSetHeading = vi.fn();
  render(
    <WebComponentFace
      kind={element.shape as 'banner'}
      element={element}
      labelNode={<span>label</span>}
      accent={colors.accent}
      fill={colors.surface}
      textColor={colors.ink}
      fontFamily={undefined}
      zoom={1}
      editable={opts.editable ?? true}
      onSetRows={onSetRows}
      onSetHeading={onSetHeading}
    />,
  );
  return { element, onSetRows, onSetHeading };
}

// Type into an in-place line and commit it with Enter, the way a user does.
function retype(name: string, text: string) {
  const line = screen.getByRole('textbox', { name });
  fireEvent.focus(line);
  line.textContent = text;
  fireEvent.keyDown(line, { key: 'Enter' });
  fireEvent.blur(line);
}

describe('web component faces (docs/specs/009-elements/web-components-and-no-groups.md)', () => {
  it('a stat value edit commits the whole row with only that value changed', () => {
    const { element, onSetRows } = renderFace('stat');
    retype('Stat 2 value', '  99.9%  ');
    expect(onSetRows).toHaveBeenCalledWith({
      stats: element.stats!.map((st, i) => (i === 1 ? { ...st, value: '99.9%' } : st)),
    });
  });

  it('a process caption and a nav link edit their own rows', () => {
    const process = renderFace('process');
    retype('Step 3', 'Launch');
    expect(process.onSetRows).toHaveBeenCalledWith({ processSteps: ['Plan', 'Build', 'Launch'] });
    cleanup();
    const header = renderFace('header');
    retype('Link 1', 'Docs');
    expect(header.onSetRows).toHaveBeenCalledWith({ navLinks: ['Docs', 'About', 'Contact'] });
  });

  it("a banner's subtitle commits through the masthead setter", () => {
    const { onSetHeading } = renderFace('banner');
    retype('Banner subtitle', 'Q3 roadmap');
    expect(onSetHeading).toHaveBeenCalledWith('pageSubtitle', 'Q3 roadmap');
  });

  it('an unchanged line commits nothing', () => {
    const { onSetRows } = renderFace('process');
    retype('Step 1', 'Plan');
    expect(onSetRows).not.toHaveBeenCalled();
  });

  it('lines are inert until the element is selected', () => {
    renderFace('stat', { editable: false });
    const line = screen.getByRole('textbox', { name: 'Stat 1 value' });
    expect(line.getAttribute('contenteditable')).toBe('false');
    expect(line.className).toContain('pointer-events-none');
  });

  it('renders one card per stat and one circle per step', () => {
    renderFace('stat');
    expect(screen.getAllByRole('textbox', { name: /value$/ })).toHaveLength(3);
    cleanup();
    const { container } = render(
      <WebComponentFace
        kind="process"
        element={{
          ...(createComponent('process', 0, 0, colors) as ShapeElement),
          processSteps: ['a', 'b', 'c', 'd', 'e'],
        }}
        labelNode={null}
        accent="#000"
        fill="#fff"
        textColor="#000"
        fontFamily={undefined}
        zoom={1}
        editable={false}
        onSetRows={() => {}}
        onSetHeading={() => {}}
      />,
    );
    expect(container.querySelectorAll('circle')).toHaveLength(5);
  });
});
