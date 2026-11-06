import { describe, expect, it } from 'vitest';
import { resolveTemplate } from './template-tab';
import { isTemplateKind, templateKindOf, TEMPLATES } from './templates';

// The Pages templates moved out to livedocuments with Pages mode, and the device wireframes they had replaced went with
// them. The Plan templates (boards, sheets, dashboards and forms) moved out to liveplanner with Plan mode. A link, an
// agent or a seed naming one is answered as any unknown kind is: /new opens Blank Space, an agent is refused with the
// five kinds it may use.
describe('retired templates', () => {
  it.each([
    'slide-deck',
    'article',
    'blank-illustration',
    'wireframe-website',
    'logo-design',
    'mobile-wireframe',
    'browser-wireframe',
    'blank-plan',
    'blank-spreadsheet',
    'kanban',
    'project-planner',
    'bug-triage',
    'team-retro',
    'okrs',
    'invoice',
    'feedback-form',
    // The retrospectives, workshops, planning and strategy boards and the quizzes and games left livehuddle for
    // meeting in Spaces (Work Tracker #423, docs/specs/007-editor/templates-by-mode.md "The catalogue").
    'retrospective',
    'start-stop-continue',
    'mad-sad-glad',
    'four-ls',
    'sailboat',
    'town-hall',
    'lean-coffee',
    'crazy-eights',
    'meeting-agenda',
    'workshop-board',
    'brainstorm',
    'affinity-map',
    'prioritization-matrix',
    'risk-matrix',
    'incident-postmortem',
    'user-persona',
    'empathy-map',
    'journey',
    'objectives-planner',
    'roadmap',
    'raci-matrix',
    'user-story-map',
    'swot',
    'pestle-analysis',
    'business-model-canvas',
    'value-proposition-canvas',
    'stakeholder-map',
    'opportunity-solution-tree',
    'kwl-chart',
    'pub-quiz',
    'icebreaker-questions',
    'two-truths-and-a-lie',
    'would-you-rather',
    'people-bingo',
  ])('%s is no template now', (old) => {
    expect(isTemplateKind(old)).toBe(false);
    expect(TEMPLATES.some((t) => (t.kind as string) === old)).toBe(false);
    expect(templateKindOf(old)).toBeNull();
    expect(resolveTemplate(old)).toBeNull();
  });

  it('passes a live kind through and refuses anything else', () => {
    expect(templateKindOf('team-pod')).toBe('team-pod');
    expect(templateKindOf('not-a-template')).toBeNull();
    expect(templateKindOf(42)).toBeNull();
    expect(templateKindOf('hasOwnProperty')).toBeNull();
  });
});
