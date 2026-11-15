// What a plan file holds, for the Import dialog's preview (docs/specs/026-plan/plan-tabs.md "The Import dialog", A
// Whole Plan; blueprint plan-file.md): read in the browser from the envelope as parseProjectEnvelope rebuilds it, so a
// count never includes what the import would leave behind for not looking like its kind. Pure, one pass over cards.
import { ATTACHMENTS_FIELD, storedImageIds, typesOf } from '@liveplanner/items';
import {
  parseProjectEnvelope,
  type ProjectEnvelope,
  type ProjectEnvelopeFailure,
} from './project-envelope';

export type ProjectFileSummary = {
  name: string;
  tabs: number;
  cards: number;
  cardTypes: number;
  threads: number;
  rules: number;
  // Whether any card holds a picture (Attachments or an Image field), for the pictures line.
  pictures: boolean;
};

export type ProjectFileSummaryRead =
  { ok: true; summary: ProjectFileSummary } | { ok: false; failure: ProjectEnvelopeFailure };

// The Image fields of the file's card types, by field id.
function imageFieldIds(project: ProjectEnvelope['project']): Set<string> {
  const ids = new Set<string>();
  for (const type of typesOf(project.itemTypes))
    for (const field of type.custom ?? []) if (field.kind === 'image') ids.add(field.id);
  return ids;
}

function holdsPictures(project: ProjectEnvelope['project']): boolean {
  const images = imageFieldIds(project);
  return (project.items ?? []).some((item) => {
    const attached = item.fields[ATTACHMENTS_FIELD];
    if (Array.isArray(attached) && attached.length > 0) return true;
    for (const id of images) if (storedImageIds(item.fields[id]).length > 0) return true;
    return false;
  });
}

export function summariseProjectFile(text: string): ProjectFileSummaryRead {
  const parsed = parseProjectEnvelope(text);
  if (!parsed.ok) return parsed;
  const { project } = parsed.envelope;
  return {
    ok: true,
    summary: {
      name: project.name,
      tabs: project.tabs.length,
      cards: project.items?.length ?? 0,
      cardTypes: project.itemTypes?.types.length ?? 0,
      threads: project.threads?.length ?? 0,
      rules: project.automations?.length ?? 0,
      pictures: holdsPictures(project),
    },
  };
}
