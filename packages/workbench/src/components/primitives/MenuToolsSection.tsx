'use client';

import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { MenuDialogSection } from './MenuDialogSection';

// What only this kind of element has, in its menu (each product's docs/specs/008-canvas/canvas-and-palette.md "An
// element's own settings open in a dialog"). There is no Tools flyout: with one section the section takes the row's
// place in the menu, as a flyout's lone section did; with more, one row named for the element opens them all in a
// dialog, where `inline` draws the same sections laid open.

// A fragment's children count one by one (a group of sections a host builds inline).
function sections(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((c) =>
    isValidElement<{ children?: ReactNode }>(c) && c.type === Fragment
      ? sections(c.props.children)
      : [c],
  );
}

export function MenuToolsSection({
  title,
  icon,
  onOpen,
  inline = false,
  always = false,
  children,
}: {
  // The element's kind, as its menu names it: "Chart", "Card".
  title: string;
  icon: ReactNode;
  // Opens the element's settings dialog.
  onOpen: () => void;
  // Inside that dialog: the sections themselves, no row.
  inline?: boolean;
  // Always the row, however few sections: a set of settings that belong together in the dialog (a Sankey's).
  always?: boolean;
  children: ReactNode;
}) {
  if (inline) return <div data-element-tools="">{children}</div>;
  const rendered = sections(children);
  if (rendered.length === 0) return null;
  const only = !always && rendered.length === 1 ? rendered[0] : null;
  if (only && isValidElement(only)) return <>{only}</>;
  return <MenuDialogSection title={title} icon={icon} onOpen={onOpen} flush />;
}
