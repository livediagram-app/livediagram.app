import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogueRow } from '@liveworkspace/settings/catalogue';
import { CATALOGUE } from '@liveworkspace/settings/catalogues/livediagram';

const sent: unknown[][] = [];
vi.mock('./explorer/telemetry', () => ({
  trackSetting: (...args: unknown[]) => void sent.push(args),
}));

const { reportAppSetting, reportSharedSetting } = await import('./settings-telemetry');

const rows = CATALOGUE.categories.flatMap((category) => category.rows);
const row = <K extends CatalogueRow['kind']>(kind: K) =>
  rows.find(
    (r): r is Extract<CatalogueRow, { kind: K }> => r.kind === kind && 'event' in r && !!r.event,
  )!;

afterEach(() => {
  sent.length = 0;
  vi.unstubAllGlobals();
});

describe('settings changed on liveworkspace.app', () => {
  it('reports a dialog row as the app’s own Settings does', () => {
    const toggle = row('toggle');
    reportAppSetting('livediagram.app', toggle, toggle.off);
    const choice = row('choice');
    const option = choice.options[1]!;
    reportAppSetting('livediagram.app', choice, option.value);
    expect(sent).toEqual([
      [
        'livediagram.app',
        { category: toggle.event!.category, action: 'Toggled', type: toggle.event!.off },
      ],
      [
        'livediagram.app',
        {
          category: choice.event!.category,
          action: 'Changed',
          type: `${choice.event!.changed}${option.id.charAt(0).toUpperCase()}${option.id.slice(1)}`,
        },
      ],
    ]);
  });

  it('reports a shared switch for the app the page was opened for, and once for liveworkspace.app otherwise', async () => {
    vi.stubGlobal('window', { location: { search: '?app=liveplanner' } });
    await reportSharedSetting('notifyComments', false);
    vi.stubGlobal('window', { location: { search: '' } });
    await reportSharedSetting('notifyComments', true);
    // A key no app has is nobody's switch.
    await reportSharedSetting('noSuchSwitch', true);
    expect(sent).toEqual([
      ['liveplanner.app', { category: 'UI', action: 'Toggled', type: 'NotifyCommentsOff' }],
      ['liveworkspace.app', { category: 'UI', action: 'Toggled', type: 'NotifyCommentsOn' }],
    ]);
  });
});
