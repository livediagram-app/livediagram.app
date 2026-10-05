'use client';

// The template step's mode filter (docs/specs/007-editor/templates-by-mode.md "The mode filter"):
// the shared ModeFilterMenu (@livediagram/ui, also the marketing gallery's) fed Everything and
// every offered mode, each with its glyph (the mode switch's) and how many templates it holds.
import { editorModeLabel } from '@livediagram/document';
import { EDITOR_MODE_ICONS, EverythingIcon, ModeFilterMenu } from '@livediagram/ui';
import type { TemplateModeFilter } from './useTemplateModeFilter';

export function TemplateModeFilterControl({ filter }: { filter: TemplateModeFilter }) {
  const { choice, options, choose, counts } = filter;
  return (
    <ModeFilterMenu
      label="Show templates for"
      value={choice}
      onChange={choose}
      options={options.map((c) => ({
        id: c,
        label: c === 'all' ? 'Everything' : editorModeLabel(c),
        Icon: c === 'all' ? EverythingIcon : EDITOR_MODE_ICONS[c],
        count: counts[c],
      }))}
    />
  );
}
