// What a plan template's file carries beyond its tabs (internal-template.ts), as /new makes a plan
// (lib/new-project-content.ts): the card types its boards bring, its example cards and its Sheets.
import { describe, expect, it } from 'vitest';
import { parseProjectEnvelope } from '@liveplanner/project';
import { FORM_TEMPLATE_KINDS, templateCatalogue } from '@liveplanner/templates';
import { readProjectFile } from '../plan-room/project-file';
import { templateProjectFile } from './internal-template';

const projectOf = (text: string) => {
  const parsed = parseProjectEnvelope(text);
  if (!parsed.ok) throw new Error(parsed.failure);
  return parsed.envelope.project;
};

describe('a plan template’s file', () => {
  it('carries the card types its boards bring and its example cards, numbered from 1', () => {
    const project = projectOf(templateProjectFile('project-planner', 'Apollo Plan')!);
    expect(project.itemTypes?.types.length).toBeGreaterThan(0);
    expect(project.items?.length).toBeGreaterThan(0);
    expect(project.items!.map((i) => i.key)).toEqual(project.items!.map((_, i) => i + 1));
    // Made by the example team's Maya, as an offline plan's are before its maker is known.
    expect(new Set(project.items!.map((i) => i.createdBy.name))).toEqual(new Set(['Maya Chen']));
  });

  it('makes a template’s Sheets from their marks, which the import’s reader takes', () => {
    const withSheets = templateCatalogue()
      .templates.map((t) => t.kind)
      .find((kind) => {
        const file = templateProjectFile(kind, 'A');
        return file !== null && (projectOf(file).sheets?.length ?? 0) > 0;
      });
    expect(withSheets).toBeDefined();
    const file = templateProjectFile(withSheets!, 'Apollo')!;
    expect(readProjectFile(file).ok).toBe(true);
  });

  it('has no file for a form template, which only the editor makes', () => {
    expect(templateProjectFile(FORM_TEMPLATE_KINDS[0]!, 'Apollo')).toBeNull();
  });
});
