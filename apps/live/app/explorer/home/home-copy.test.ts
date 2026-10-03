import { describe, expect, it } from 'vitest';
import type { HomeDocument, HomeGroup, HomePerson, HomeVerb } from '@livediagram/api-schema';
import {
  actionDetail,
  actionPhrase,
  locationLabel,
  peopleList,
  personName,
  summarySentence,
  timelineEntryLabel,
  updatesLabel,
  verbList,
} from './home-copy';

// Every word Home says (docs/specs/013-workspace/explorer-home.md "What happened", "Timeline").

const person = (name: string | null): HomePerson => ({
  id: name ?? 'x',
  name,
  color: null,
  pictureUrl: null,
});
const doc: HomeDocument = {
  documentId: 'd1',
  name: 'Payments architecture',
  via: 'team',
  shareCode: null,
  tabId: null,
  teamId: 't1',
  teamName: 'Platform team',
  folderId: null,
  folderName: null,
  ownerName: 'Priya',
  savedAt: 1,
  empty: false,
};
const verbs = (...vs: HomeVerb[]) => vs.map((verb) => ({ verb, count: 1 }));

describe('personName', () => {
  it('names a person, or Someone when nobody knows their name', () => {
    expect(personName(person('Priya'))).toBe('Priya');
    expect(personName(person(null))).toBe('Someone');
    expect(personName(person('  '))).toBe('Someone');
    expect(personName(undefined)).toBe('Someone');
  });
});

describe('peopleList', () => {
  it('names up to three, then counts the others', () => {
    expect(peopleList([person('Priya')])).toBe('Priya');
    expect(peopleList([person('Priya'), person('Sam')])).toBe('Priya and Sam');
    expect(peopleList([person('Priya'), person('Sam'), person('Lee')])).toBe('Priya, Sam and Lee');
    expect(peopleList(['Priya', 'Sam', 'Lee', 'Ana'].map(person))).toBe(
      'Priya, Sam, Lee and 1 other',
    );
    expect(peopleList(['Priya', 'Sam', 'Lee', 'Ana', 'Bo'].map(person))).toBe(
      'Priya, Sam, Lee and 2 others',
    );
  });
});

describe('verbList', () => {
  it('joins the verb phrases in the order given', () => {
    expect(verbList(verbs('commented', 'edited', 'assigned_you'))).toBe(
      'commented, edited and assigned you an action',
    );
    expect(verbList(verbs('resolved'))).toBe('resolved a thread');
  });
});

describe('summarySentence', () => {
  const group = (vs: HomeVerb[]) =>
    ({
      ...doc,
      people: [person('Priya'), person('Sam'), person('Lee')],
      verbs: verbs(...vs),
    }) as HomeGroup;

  it('says who did what in which document', () => {
    expect(summarySentence(group(['commented', 'edited', 'assigned_you']))).toEqual({
      people: 'Priya, Sam and Lee',
      verbs: 'commented, edited and assigned you an action',
      preposition: 'in',
      document: 'Payments architecture',
    });
  });

  it('drops the preposition when every verb takes the document directly', () => {
    expect(summarySentence(group(['edited', 'shared'])).preposition).toBeNull();
  });
});

describe('actionPhrase', () => {
  it('reads as a sentence before the document', () => {
    expect(actionPhrase('commented')).toBe('commented on');
    expect(actionPhrase('replied')).toBe('replied on');
    expect(actionPhrase('resolved')).toBe('resolved a thread in');
    expect(actionPhrase('edited')).toBe('edited');
    expect(actionPhrase('assigned_you')).toBe('assigned you an action in');
    expect(actionPhrase('assigned')).toBe('assigned an action in');
    expect(actionPhrase('completed')).toBe('completed an action in');
    expect(actionPhrase('shared')).toBe('shared');
  });
});

describe('actionDetail', () => {
  const action = (verb: HomeVerb, detail: string | null) => ({
    id: 'a',
    verb,
    personId: 'p',
    occurredAt: 1,
    detail,
  });

  it('quotes words and action names, and says nothing for edits and shares', () => {
    expect(actionDetail(action('commented', 'Looks good'))).toBe('“Looks good”');
    expect(actionDetail(action('assigned_you', 'Review API'))).toBe('“Review API”');
    expect(actionDetail(action('edited', null))).toBeNull();
    expect(actionDetail(action('shared', 'Platform team'))).toBeNull();
    expect(actionDetail(action('commented', '   '))).toBeNull();
  });
});

describe('updatesLabel', () => {
  it('counts updates', () => {
    expect(updatesLabel(1)).toBe('1 update');
    expect(updatesLabel(5)).toBe('5 updates');
  });
});

describe('locationLabel', () => {
  it('names the space and the folder', () => {
    expect(locationLabel(doc)).toBe('Platform team');
    expect(locationLabel({ ...doc, folderName: 'Architecture' })).toBe(
      'Platform team › Architecture',
    );
    expect(locationLabel({ ...doc, via: 'own', teamName: null, folderName: 'Specs' })).toBe(
      'My documents › Specs',
    );
  });

  it('names the owner of a shared document', () => {
    expect(locationLabel({ ...doc, via: 'shared', teamName: null })).toBe('Shared by Priya');
    expect(locationLabel({ ...doc, via: 'shared', teamName: null, ownerName: null })).toBe(
      'Shared with you',
    );
  });
});

describe('timelineEntryLabel', () => {
  it('names the document, what happened and when', () => {
    const at = new Date(2026, 7, 30, 14, 5).getTime();
    expect(
      timelineEntryLabel({ name: doc.name, kind: 'created', occurredAt: at }, () => '14:05'),
    ).toBe('Payments architecture, created at 14:05');
  });
});
