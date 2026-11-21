// docs/specs/013-workspace/automations.md "Telemetry": every event the screen sends, as livedesign's telemetry
// says it, and its routes over the editor's api.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const track = vi.fn<(...args: unknown[]) => void>();
vi.mock('@/lib/telemetry', () => ({
  track: (...args: unknown[]) => {
    track(...args);
  },
}));

const { DESIGN_AUTOMATIONS_PLUMBING, automationsBase, trackDesignAutomations } =
  await import('./design-plumbing');

beforeEach(() => track.mockReset());

type Event = Parameters<typeof trackDesignAutomations>[0];
const SAID: Record<Event, [string, string, string]> = {
  opened: ['UI', 'Opened', 'Automations'],
  opened_offline: ['UI', 'Opened', 'AutomationsOffline'],
  opened_sign_in: ['UI', 'Opened', 'AutomationsSignIn'],
  describe_opened: ['UI', 'Opened', 'AutomationDescribe'],
  template_opened: ['UI', 'Opened', 'AutomationTemplate.library-updated'],
  rule_created: ['Document', 'Created', 'AutomationRule'],
  draft_created: ['Document', 'Created', 'AutomationDraft'],
  secret_created: ['Document', 'Created', 'AutomationSecret'],
  secret_changed: ['Document', 'Changed', 'AutomationSecret'],
  secret_copied: ['Document', 'Copied', 'AutomationSecret'],
  rule_on: ['Document', 'Toggled', 'AutomationOn'],
  rule_off: ['Document', 'Toggled', 'AutomationOff'],
  rule_deleted: ['Document', 'Deleted', 'AutomationRule'],
  rule_tested: ['Document', 'Tested', 'AutomationRule'],
  rule_run: ['Document', 'Ran', 'AutomationManual'],
};

describe('the design’s Automations plumbing', () => {
  it.each(Object.entries(SAID) as [Event, [string, string, string]][])('says %s', (event, said) => {
    trackDesignAutomations(event, event === 'template_opened' ? 'library-updated' : undefined);
    expect(track).toHaveBeenCalledExactlyOnceWith(...said);
  });

  it('hands the track to the screen, with the design’s words', () => {
    DESIGN_AUTOMATIONS_PLUMBING.track('rule_run');
    expect(track).toHaveBeenCalledWith('Document', 'Ran', 'AutomationManual');
    expect(DESIGN_AUTOMATIONS_PLUMBING.words.toolLine).toBeTruthy();
  });

  it('names a design’s rules under its own address', () => {
    expect(automationsBase('d/1')).toMatch(/\/designs\/d%2F1\/automations$/);
  });
});
