// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Profile, ProfileHost, ProfilePatch } from './profile-host';
import { TimeZoneRow, TimeZoneSection } from './TimeZonePicker';
import {
  browserTimeZone,
  filterZones,
  resetZoneOptions,
  zoneLabel,
  zoneOption,
  zoneOptions,
} from './time-zones';

// Settings › Profile › Time Zone (liveworkspace/docs/specs/010-site/site.md "Settings", "Profile"): Automatic or a zone
// picked from a searchable list, saved at once through the host, put back when the write is refused.

afterEach(() => {
  resetZoneOptions();
  vi.restoreAllMocks();
});

const detected = browserTimeZone();
const automaticLabel = () => (detected ? `Automatic: ${zoneLabel(detected)}` : 'Automatic');

const profile = (timeZone: string | null, timeZoneAuto: boolean): Profile => ({
  id: 'user_ada',
  name: null,
  color: null,
  timeZone,
  timeZoneAuto,
});

// A host whose save answers the profile as the accounts API would: a pick kept, Automatic back on the browser's zone.
function fakeHost(overrides: Partial<ProfileHost> = {}): ProfileHost {
  return {
    accountName: 'Ada Lovelace',
    load: vi.fn(async () => ({ ok: true as const, data: profile(detected, true) })),
    save: vi.fn(async (patch: ProfilePatch) => ({
      ok: true as const,
      data:
        patch.timeZone === null
          ? profile(detected, true)
          : profile(patch.timeZone ?? null, patch.timeZone === undefined),
    })),
    ...overrides,
  };
}

const zoneButton = () => screen.getByRole('button', { name: /Your Time Zone/ });
const open = () => {
  fireEvent.click(zoneButton());
  return screen.getByRole('listbox', { name: 'Time zones' });
};
const search = (text: string) =>
  fireEvent.change(screen.getByRole('combobox', { name: 'Search time zones' }), {
    target: { value: text },
  });

describe('the Time Zone row', () => {
  it('reads the profile, says Automatic with the browser’s zone, and lists Automatic first, checked', async () => {
    const host = fakeHost();
    render(<TimeZoneSection host={host} />);
    expect(screen.getByLabelText('Loading your time zone')).toBeTruthy();
    expect(await screen.findByText(automaticLabel())).toBeTruthy();
    expect(screen.getByText(/Emails that can wait arrive in your daytime/)).toBeTruthy();
    expect(zoneButton().getAttribute('aria-expanded')).toBe('false');
    const list = open();
    expect(zoneButton().getAttribute('aria-expanded')).toBe('true');
    const options = within(list).getAllByRole('option');
    expect(options[0]!.textContent).toContain('Automatic');
    expect(options[0]!.getAttribute('aria-selected')).toBe('true');
    // Every zone the browser knows follows.
    expect(options.length).toBeGreaterThan(100);
    expect(host.load).toHaveBeenCalledTimes(1);
  });

  it('searches by city, and saves a pick at once', async () => {
    const host = fakeHost();
    render(<TimeZoneRow initial={profile(detected, true)} host={host} />);
    const list = open();
    search('tokyo');
    fireEvent.click(within(list).getByRole('option', { name: /Tokyo/ }));
    expect(host.save).toHaveBeenCalledWith({ timeZone: 'Asia/Tokyo' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByText('Tokyo (GMT+9)')).toBeTruthy();
    expect(await screen.findByText('Saved')).toBeTruthy();
  });

  it('searches by offset, with a hyphen or a true minus', () => {
    render(<TimeZoneRow initial={profile('Europe/London', true)} host={fakeHost()} />);
    const list = open();
    search('gmt+5:30');
    const names = within(list)
      .getAllByRole('option')
      .map((option) => option.textContent ?? '');
    expect(names.some((name) => /Kolkata|Calcutta/.test(name))).toBe(true);
    search('nowhere at all');
    expect(within(list).queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('No time zone matches “nowhere at all”.')).toBeTruthy();
  });

  it('goes back to Automatic from a zone picked by hand', async () => {
    const host = fakeHost();
    render(<TimeZoneRow initial={profile('Asia/Tokyo', false)} host={host} />);
    expect(screen.getByText('Tokyo (GMT+9)')).toBeTruthy();
    const list = open();
    expect(within(list).getByRole('option', { name: /Tokyo/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
    fireEvent.click(within(list).getByRole('option', { name: /Automatic/ }));
    expect(host.save).toHaveBeenCalledWith({ timeZone: null });
    expect(await screen.findByText(automaticLabel())).toBeTruthy();
  });

  it('puts the zone back and says why when the write is refused', async () => {
    const host = fakeHost({
      save: vi.fn(async () => ({ ok: false as const, error: 'offline' })),
      errorMessage: (error) => `Refused: ${error}`,
    });
    render(<TimeZoneRow initial={profile(detected, true)} host={host} />);
    const list = open();
    search('tokyo');
    fireEvent.click(within(list).getByRole('option', { name: /Tokyo/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('Refused: offline');
    expect(screen.getByText(automaticLabel())).toBeTruthy();
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('picking the zone already in force writes nothing', () => {
    const host = fakeHost();
    render(<TimeZoneRow initial={profile('Asia/Tokyo', false)} host={host} />);
    const list = open();
    fireEvent.click(within(list).getByRole('option', { name: /Tokyo/ }));
    expect(host.save).not.toHaveBeenCalled();
  });

  it('moves with the arrow keys, picks with Enter, and closes with Escape alone', () => {
    const host = fakeHost();
    render(<TimeZoneRow initial={profile(detected, true)} host={host} />);
    open();
    const field = screen.getByRole('combobox', { name: 'Search time zones' });
    expect(document.activeElement).toBe(field);
    search('new york');
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    expect(field.getAttribute('aria-activedescendant')).toBeTruthy();
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(host.save).toHaveBeenCalledWith({ timeZone: 'America/New_York' });

    // Escape closes the list and gives focus back to the button; the panel behind never hears it.
    const heard = vi.fn();
    document.addEventListener('keydown', heard);
    open();
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Search time zones' }), {
      key: 'Escape',
    });
    document.removeEventListener('keydown', heard);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(zoneButton());
    expect(heard).not.toHaveBeenCalled();
  });

  // Under Next, React's listener and a Dialog's Escape listener share one node (the document): the list's Escape must
  // stop that one too, or it closes the whole Settings dialog behind it.
  it("keeps its Escape from a listener on React's own root node", () => {
    const root = document.createElement('div');
    document.body.append(root);
    render(<TimeZoneRow initial={profile(detected, true)} host={fakeHost()} />, {
      container: root,
    });
    const heard = vi.fn();
    root.addEventListener('keydown', heard);
    open();
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Search time zones' }), {
      key: 'Escape',
    });
    root.removeEventListener('keydown', heard);
    root.remove();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(heard).not.toHaveBeenCalled();
  });

  // design-principles.md: Enter, Escape and the arrows confirm, drop or move through an input method's word first.
  it('leaves Enter, Escape and the arrows to an input method composing a word', () => {
    const host = fakeHost();
    render(<TimeZoneRow initial={profile(detected, true)} host={host} />);
    open();
    const field = screen.getByRole('combobox', { name: 'Search time zones' });
    search('new york');
    const active = field.getAttribute('aria-activedescendant');
    fireEvent.keyDown(field, { key: 'ArrowDown', isComposing: true });
    fireEvent.keyDown(field, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(field, { key: 'Enter', keyCode: 229 });
    fireEvent.keyDown(field, { key: 'Escape', isComposing: true });
    expect(field.getAttribute('aria-activedescendant')).toBe(active);
    expect(host.save).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('closes when focus moves on to another control, leaving focus there', () => {
    render(
      <>
        <TimeZoneRow initial={profile(detected, true)} host={fakeHost()} />
        <button type="button">Next</button>
      </>,
    );
    open();
    const field = screen.getByRole('combobox', { name: 'Search time zones' });
    const next = screen.getByRole('button', { name: 'Next' });
    // Leaving the window (no new target) keeps it.
    fireEvent.blur(field, { relatedTarget: null });
    expect(screen.getByRole('listbox')).toBeTruthy();
    next.focus();
    fireEvent.blur(field, { relatedTarget: next });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(zoneButton().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(next);
  });

  it('closes when the pointer goes down outside it', () => {
    render(
      <>
        <p>Elsewhere</p>
        <TimeZoneRow initial={profile(detected, true)} host={fakeHost()} />
      </>,
    );
    open();
    fireEvent.pointerDown(screen.getByText('Elsewhere'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('says so with Try Again when the read fails, and reads again', async () => {
    let fail = true;
    const host = fakeHost({
      load: vi.fn(async () =>
        fail
          ? { ok: false as const, error: 'offline' }
          : { ok: true as const, data: profile('Asia/Tokyo', false) },
      ),
      errorMessage: () => 'Couldn’t read it.',
    });
    render(<TimeZoneSection host={host} />);
    expect((await screen.findByRole('alert')).textContent).toBe('Couldn’t read it.');
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByText('Tokyo (GMT+9)')).toBeTruthy();
    expect(host.load).toHaveBeenCalledTimes(2);
  });

  it('builds the list only when it opens, once for the page', async () => {
    const list = vi.spyOn(Intl, 'supportedValuesOf');
    render(<TimeZoneRow initial={profile('Asia/Tokyo', false)} host={fakeHost()} />);
    // The closed row needs only the zone in force.
    expect(list).not.toHaveBeenCalled();
    open();
    expect(list).toHaveBeenCalledTimes(1);
    fireEvent.click(zoneButton());
    open();
    await waitFor(() => expect(screen.getByRole('listbox')).toBeTruthy());
    expect(list).toHaveBeenCalledTimes(1);
  });
});

describe('the zones offered', () => {
  it('names each by city, region and offset, half hours and true minus signs included', () => {
    expect(zoneOption('Asia/Kolkata')).toMatchObject({
      id: 'Asia/Kolkata',
      city: 'Kolkata',
      region: 'Asia',
      offset: 'GMT+5:30',
      minutes: 330,
    });
    expect(zoneOption('America/Argentina/Buenos_Aires')).toMatchObject({
      city: 'Buenos Aires',
      region: 'Argentina, America',
      offset: 'GMT−3',
      minutes: -180,
    });
    expect(zoneOption('UTC')).toMatchObject({ city: 'UTC', region: '', offset: 'GMT+0' });
    expect(zoneOption('Mars/Olympus_Mons')).toBeNull();
    expect(zoneLabel('Asia/Tokyo')).toBe('Tokyo (GMT+9)');
    expect(zoneLabel('Mars/Olympus_Mons')).toBe('Mars/Olympus_Mons');
  });

  it('lists every zone once, by offset then city, with the ones handed in that the list leaves out', () => {
    const all = zoneOptions(['Asia/Kolkata', null, 'Mars/Olympus_Mons']);
    const ids = all.map((zone) => zone.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('UTC');
    expect(ids).toContain('Asia/Kolkata');
    // Its old name, which some engines list, is the same place: shown once, under the name handed in.
    expect(ids).not.toContain('Asia/Calcutta');
    expect(ids).not.toContain('Mars/Olympus_Mons');
    for (let i = 1; i < all.length; i++) {
      const [a, b] = [all[i - 1]!, all[i]!];
      const inOrder =
        a.minutes < b.minutes || (a.minutes === b.minutes && a.city.localeCompare(b.city) <= 0);
      expect(inOrder).toBe(true);
    }
  });

  it('shows a place once when the zone kept and the browser name it differently, the zone kept winning', () => {
    const kept = zoneOptions(['Asia/Calcutta', 'Asia/Kolkata']).map((zone) => zone.id);
    expect(kept).toContain('Asia/Calcutta');
    expect(kept).not.toContain('Asia/Kolkata');
    resetZoneOptions();
    const renamed = zoneOptions(['Asia/Kolkata', 'Asia/Calcutta']).map((zone) => zone.id);
    expect(renamed).toContain('Asia/Kolkata');
    expect(renamed).not.toContain('Asia/Calcutta');
    // Two places at the same offset stay two.
    resetZoneOptions();
    expect(zoneOptions(['Asia/Colombo', 'Asia/Kolkata']).map((zone) => zone.id)).toEqual(
      expect.arrayContaining(['Asia/Colombo', 'Asia/Kolkata']),
    );
  });

  it('keeps every word of a search, matching the name, city, region or offset', () => {
    const all = zoneOptions();
    expect(filterZones(all, '')).toBe(all);
    expect(filterZones(all, 'buenos').map((zone) => zone.city)).toContain('Buenos Aires');
    expect(filterZones(all, 'gmt-3').some((zone) => zone.city === 'Buenos Aires')).toBe(true);
    expect(filterZones(all, 'GMT−3').some((zone) => zone.city === 'Buenos Aires')).toBe(true);
    expect(filterZones(all, 'america new_york').map((zone) => zone.id)).toContain(
      'America/New_York',
    );
    expect(filterZones(all, 'europe tokyo')).toEqual([]);
  });

  it('still offers the zones handed in, and UTC, where the browser has no list', () => {
    vi.spyOn(Intl, 'supportedValuesOf').mockImplementation(() => {
      throw new TypeError('not supported');
    });
    expect(zoneOptions(['Asia/Tokyo']).map((zone) => zone.id)).toEqual(['UTC', 'Asia/Tokyo']);
  });
});
