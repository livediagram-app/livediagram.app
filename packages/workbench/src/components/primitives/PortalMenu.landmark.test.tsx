// @vitest-environment jsdom
// Every PortalMenu is portalled to the body, outside every landmark, so a command menu always stands in a named
// region of its own and a control menu (a dialog, which axe counts as one) needs none
// (docs/specs/004-interface-design/menus.md "Semantics"). axe runs over the page with each open.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { axeViolations } from '@liveworkspace/vitest-config/axe';
import { MenuActionRow, MenuHeader, PortalMenu } from './PortalMenu';

afterEach(cleanup);

function Host(props: Partial<React.ComponentProps<typeof PortalMenu>> & { header?: string }) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const { header, ...rest } = props;
  return (
    <main>
      <button
        ref={setAnchor}
        type="button"
        aria-label="More for Specs"
        onClick={() => setOpen(true)}
      >
        ⋯
      </button>
      {open ? (
        <PortalMenu anchor={anchor} onClose={() => setOpen(false)} {...rest}>
          {header ? <MenuHeader title={header} /> : null}
          <MenuActionRow label="Rename" icon={null} onClick={() => {}} />
          <MenuActionRow label="Delete" icon={null} onClick={() => {}} />
        </PortalMenu>
      ) : null}
    </main>
  );
}

const open = () => fireEvent.click(screen.getByRole('button', { name: 'More for Specs' }));

describe('PortalMenu landmark', () => {
  it('stands a command menu in a region named after its anchor, and axe is clean', async () => {
    render(<Host />);
    open();
    const menu = screen.getByRole('menu');
    const region = screen.getByRole('region', { name: 'More for Specs' });
    expect(region.contains(menu)).toBe(true);
    expect(await axeViolations()).toEqual([]);
  });

  it('names the region by its label, or by the landmark given', async () => {
    const { unmount } = render(<Host label="Actions for Specs" />);
    open();
    expect(screen.getByRole('region', { name: 'Actions for Specs' })).toBeTruthy();
    unmount();
    render(<Host label="Actions for Specs" landmark="Specs actions" header="Specs" />);
    open();
    expect(screen.getByRole('region', { name: 'Specs actions' })).toBeTruthy();
    expect(await axeViolations()).toEqual([]);
  });

  it('gives a control menu no region of its own, a dialog being one, and axe is clean', async () => {
    render(<Host surface="control" label="Tab menu" />);
    open();
    expect(screen.getByRole('dialog', { name: 'Tab menu' })).toBeTruthy();
    expect(screen.queryByRole('region')).toBeNull();
    expect(await axeViolations()).toEqual([]);
  });

  it('still takes a region on a control menu when one is asked for', () => {
    render(<Host surface="control" label="Tab menu" landmark="Tab options" />);
    open();
    expect(screen.getByRole('region', { name: 'Tab options' })).toBeTruthy();
  });
});
