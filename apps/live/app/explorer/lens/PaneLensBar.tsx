'use client';

import { useMemo } from 'react';
import { lensChips } from '@livediagram/explorer-lens';
import { useExplorer } from '../ExplorerContext';
import { chooseChipValue } from './field-model';
import { LensChips } from './LensChips';

// The lens under a document view's header (docs/specs/013-workspace/explorer-filters.md "The chip
// row"): its chips and the reported words. A view with no lens shows none of it. While the
// filtered-empty state names the words itself (`showIssues` false), the row leaves them to it.
export function PaneLensBar({ showIssues = true }: { showIssues?: boolean }) {
  const { lens, lensResult } = useExplorer();
  const chips = useMemo(() => lensChips(lens.parsed, lens.context), [lens.parsed, lens.context]);
  if (lens.view === null) return null;
  return (
    <LensChips
      chips={chips}
      issues={showIssues ? lens.parsed.issues : []}
      active={lensResult.active || lens.input.trim() !== ''}
      onChoose={(dimension, value) =>
        lens.setInput(chooseChipValue(lens.input, dimension, value, lens.context))
      }
      onClear={() => lens.setInput('')}
    />
  );
}
