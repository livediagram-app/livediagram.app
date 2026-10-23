import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Member } from '@/lib/account-api';
import { AvatarStack, PersonAvatar, TeamAvatar } from './Avatars';
import { BackBar } from './BackBar';
import { NewTeamPopover } from './NewTeamPopover';
import { RoleBadge } from './RoleBadge';

// The teams pages' pieces (liveworkspace/docs/site.md "Your account"), as they render.

const member = (id: string, name: string | null, status: Member['status'] = 'joined'): Member => ({
  id,
  userId: null,
  email: `${id}@example.com`,
  name,
  role: 'member',
  status,
  expired: false,
  createdAt: 0,
});

describe('BackBar', () => {
  const html = renderToStaticMarkup(
    <BackBar href="/account/teams" label="All teams" current="Northwind" />,
  );

  it('is a link back, in a breadcrumb landmark, with the page named in a chip', () => {
    expect(html).toMatch(/^<nav aria-label="Breadcrumb"><a href="\/account\/teams"/);
    expect(html).toContain('All teams');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('Northwind');
  });

  it('keeps the apps’ bar: a full-width row 44px tall, its chevron in a well', () => {
    expect(html).toContain('w-full');
    // py-2.5 around a 24px well: 44px, a whole tap target on its own.
    expect(html).toContain('py-2.5');
    expect(html).toContain('h-6 w-6');
  });
});

describe('avatars', () => {
  it('draws a person as their initials, centred optically', () => {
    const html = renderToStaticMarkup(<PersonAvatar member={member('a', 'Wendy Tran')} />);
    expect(html).toContain('<span class="text-optical-centre">WT</span>');
    expect(html).toContain('aria-hidden="true"');
  });

  it('draws someone not yet in the team as an outline', () => {
    const html = renderToStaticMarkup(
      <PersonAvatar member={member('anna.smith', null, 'invited')} />,
    );
    expect(html).toContain('border-dashed');
    expect(html).toContain('>AS<');
  });

  it('draws a team as its initials in a tile', () => {
    const html = renderToStaticMarkup(<TeamAvatar id="t" name="Northwind design" />);
    expect(html).toContain('>ND<');
  });

  it('stacks four people and counts the rest, naming everyone for screen readers', () => {
    const people = ['a', 'b', 'c', 'd', 'e'].map((id) => member(id, `Person ${id}`));
    const html = renderToStaticMarkup(<AvatarStack members={people} total={7} />);
    expect(html.match(/rounded-full/g)?.length).toBe(5);
    expect(html).toContain('+3');
    expect(html).toContain('<span class="sr-only">Person a, Person b');
  });
});

describe('RoleBadge', () => {
  it('names the role, or an invitation still waiting', () => {
    expect(renderToStaticMarkup(<RoleBadge role="admin" />)).toContain('>Admin<');
    expect(renderToStaticMarkup(<RoleBadge role="member" />)).toContain('>Member<');
    expect(renderToStaticMarkup(<RoleBadge invited />)).toContain('>Invited<');
  });
});

describe('NewTeamPopover', () => {
  it('starts closed: a button that says it opens a dialog', () => {
    const html = renderToStaticMarkup(<NewTeamPopover />);
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('New team');
    expect(html).not.toContain('role="dialog"');
    // A 44px tap target on a touch screen, on a positioned host.
    expect(html).toMatch(/class="[^"]*\brelative\b[^"]*\btouch-target-y\b/);
  });
});
