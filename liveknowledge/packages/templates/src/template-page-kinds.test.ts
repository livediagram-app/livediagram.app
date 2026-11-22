// templatePageKind (docs/specs/007-editor/start-diagramming.md "Page type"): every listed template's page kind is
// the kind of the pages it really makes, so the start screen's page type switch never files a template wrongly.
import { describe, expect, it } from 'vitest';
import { tabPageKind } from '@liveknowledge/document';
import { TEMPLATES } from './templates';
import { templateCanvasOverrides } from './template-canvas-overrides';
import { templatePageKind } from './template-page-kinds';

describe('templatePageKind', () => {
  it.each(TEMPLATES.filter((t) => !t.hidden).map((t) => [t.kind]))('%s', (kind) => {
    const pages = templateCanvasOverrides(kind).pages;
    expect(templatePageKind(kind)).toBe(pages?.length ? tabPageKind(pages) : null);
  });
});
