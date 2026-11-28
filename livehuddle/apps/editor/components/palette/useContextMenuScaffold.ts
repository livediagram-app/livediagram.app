import { useState } from 'react';

// Shared accordion scaffolding for the editor context menu's element and multi-selection branches: an
// at-most-one-open accordion (sectionProps). The colour rows and side flyouts that once shared it left with the
// Appearance flyout (docs/specs/002-project-scope/not-in-livehuddle.md
// "Element looks, layers, opacity and rotation").
export function useContextMenuScaffold() {
  // Which collapsible section is open, at most one at a time (null = all
  // collapsed). Rows sit flush; the MenuGroupSeparator bands are the only rules.
  const [openSection, setOpenSection] = useState<string | null>(null);
  const sectionProps = (id: string) => ({
    open: openSection === id,
    onToggle: () => setOpenSection((s) => (s === id ? null : id)),
    flush: true,
  });
  return { sectionProps };
}
