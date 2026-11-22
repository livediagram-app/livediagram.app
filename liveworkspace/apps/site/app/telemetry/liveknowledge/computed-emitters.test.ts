import { describe, expect, it } from 'vitest';
import { KNOWLEDGE_TOUR_STEP_SOURCE } from './computed-emitters';

// The Get Started tours (docs/specs/007-editor/knowledge-tours.md "Telemetry"): the dashboard reads every tour's steps
// from the editor's step plan, each tour ending on its closing card.
describe('Get Started tour steps', () => {
  it('reads every step of every tour', () => {
    for (const token of ['FirstPage', 'Organise', 'Trust', 'Ask', 'Connect', 'WorkTogether'])
      expect(KNOWLEDGE_TOUR_STEP_SOURCE, token).toContain(`KnowledgeTourStep${token}Done`);
    expect(KNOWLEDGE_TOUR_STEP_SOURCE).toContain('KnowledgeTourStepFirstPageNewPage');
    expect(KNOWLEDGE_TOUR_STEP_SOURCE).toContain('KnowledgeTourStepTrustVerify');
    expect(KNOWLEDGE_TOUR_STEP_SOURCE).toContain('KnowledgeTourStepConnectStatus');
    // 26 steps across the six tours, and a closing card each.
    expect(KNOWLEDGE_TOUR_STEP_SOURCE).toHaveLength(26 + 6);
  });
});
