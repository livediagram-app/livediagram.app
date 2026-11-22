// docs/specs/013-workspace/automations.md "Telemetry": every event the screen sends, as liveknowledge' telemetry
// says it, and its routes over the editor's api.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const track = vi.fn<(...args: unknown[]) => void>();
vi.mock('@/lib/telemetry', () => ({
  track: (...args: unknown[]) => {
    track(...args);
  },
}));

const { DOCUMENT_AUTOMATIONS_PLUMBING, automationsBase, trackDocumentAutomations } =
  await import('./document-plumbing');

beforeEach(() => track.mockReset());

type Event = Parameters<typeof trackDocumentAutomations>[0];
const SAID: Record<Event, [string, string, string]> = {
  opened: ['UI', 'Opened', 'Automations'],
  opened_offline: ['UI', 'Opened', 'AutomationsOffline'],
  opened_sign_in: ['UI', 'Opened', 'AutomationsSignIn'],
  describe_opened: ['UI', 'Opened', 'AutomationDescribe'],
  template_opened: ['UI', 'Opened', 'AutomationTemplate.reset-letter'],
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

describe('the document’s Automations plumbing', () => {
  it.each(Object.entries(SAID) as [Event, [string, string, string]][])('says %s', (event, said) => {
    trackDocumentAutomations(event, event === 'template_opened' ? 'reset-letter' : undefined);
    expect(track).toHaveBeenCalledExactlyOnceWith(...said);
  });

  it('hands the track to the screen, with the document’s words', () => {
    DOCUMENT_AUTOMATIONS_PLUMBING.track('rule_run');
    expect(track).toHaveBeenCalledWith('Document', 'Ran', 'AutomationManual');
    expect(DOCUMENT_AUTOMATIONS_PLUMBING.words.toolLine).toBeTruthy();
  });

  it('names a document’s rules under its own address', () => {
    expect(automationsBase('doc/1')).toMatch(/\/documents\/doc%2F1\/automations$/);
  });
});
