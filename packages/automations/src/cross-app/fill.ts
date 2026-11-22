// A step in another app's texts filled with the run's values (liveworkspace/docs/specs/018-automations/automations.md
// "Steps in other apps": every text box takes the trigger's values), each cut to its bound. Pure: the item engine's
// room and liveplanner's planner both fill with it.
import type { CrossAppStep } from '@liveworkspace/index-client';
import { cutText } from '@liveworkspace/model-core/text-cut';

const filled = (text: string, fill: (text: string) => string, max: number) =>
  cutText(fill(text).trim(), max);

/** The step with every text filled in, cut to its bound; null when a text it needs came out empty. */
export function fillCrossAppStep(
  step: CrossAppStep,
  fill: (text: string) => string,
): CrossAppStep | null {
  switch (step.kind) {
    case 'plan_card': {
      const title = filled(step.title, fill, 200);
      if (!title) return null;
      const { assignee: written, ...rest } = step;
      const assignee = written === undefined ? '' : filled(written, fill, 80);
      return {
        ...rest,
        title,
        description: filled(step.description, fill, 2000),
        ...(assignee ? { assignee } : {}),
      };
    }
    case 'kb_page': {
      const title = filled(step.title, fill, 200);
      const body = filled(step.body, fill, 20_000);
      return title && body ? { ...step, title, body } : null;
    }
    case 'space_post': {
      const text = filled(step.text, fill, 2000);
      return text ? { ...step, text } : null;
    }
    case 'doc_tab': {
      const name = filled(step.name, fill, 200);
      return name ? { ...step, name } : null;
    }
    case 'inbox_notice': {
      const text = filled(step.text, fill, 2000);
      const to = step.to
        .map((r) => ('person' in r ? r : { value: filled(r.value, fill, 80) }))
        .filter((r) => 'person' in r || r.value !== '');
      return text && to.length ? { ...step, to, text } : null;
    }
  }
}
