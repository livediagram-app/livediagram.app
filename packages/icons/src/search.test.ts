import { describe, expect, it } from 'vitest';
import { iconsLike, isIconId, searchIcons } from './search';
import { matches, paletteRank } from './search-rank';

describe('paletteRank', () => {
  it('ranks exact, prefix, substring, keyword, then no match', () => {
    const item = { name: 'Database', keywords: 'db storage' };
    expect(['database', 'data', 'base', 'storage', 'zzz'].map((q) => paletteRank(q, item))).toEqual(
      [0, 1, 2, 3, 4],
    );
    expect(matches('', 'anything')).toBe(true);
  });
});

describe('searchIcons', () => {
  it('finds line art and Technology icons, best first, and counts the rest', () => {
    const { icons, more } = searchIcons('database', 3);
    expect(icons).toHaveLength(3);
    expect(icons[0]!.label.toLowerCase()).toBe('database');
    expect(
      new Set(searchIcons('database', 50).icons.map((i) => i.set)).size,
    ).toBeGreaterThanOrEqual(1);
    expect(more).toBe(
      searchIcons('database', 50).icons.length + searchIcons('database', 50).more - 3,
    );
  });

  it('reaches the Technology catalogue, and finds nothing for nonsense', () => {
    const all = searchIcons('a', 1000).icons;
    expect(all.length).toBeGreaterThan(10);
    expect(searchIcons('qqqqzzzz', 10)).toEqual({ icons: [], more: 0 });
    expect(searchIcons('lambda', 50).icons.some((i) => i.set === 'technology')).toBe(true);
  });
});

describe('icon ids', () => {
  it('knows the catalogues’ ids and suggests icons like one that is not', () => {
    expect(isIconId('clock')).toBe(true);
    expect(isIconId('flame')).toBe(true);
    expect(isIconId('fire')).toBe(false);
    expect(iconsLike('fire').map((i) => i.id)).toContain('flame');
    expect(iconsLike('alarm-clock', 2)).toHaveLength(2);
    expect(iconsLike('---')).toEqual([]);
    expect(iconsLike('qqqqzz')).toEqual([]);
  });
});

describe('searchIcons, several words and spacing', () => {
  const ids = (q: string) => searchIcons(q, 5).icons.map((i) => i.id);
  it('finds an icon holding every word of a several-word query', () => {
    expect(ids('credit card')[0]).toBe('credit-card');
    expect(ids('shopping cart')[0]).toBe('cart');
    expect(ids('mobile phone')).toContain('smartphone');
  });
  it('reads a word only where a word starts: lock is not clock, load not download', () => {
    expect(ids('lock auth')).not.toContain('clock');
    expect(ids('load balancer')).not.toContain('download');
  });
  it('matches spacing aside', () => {
    expect(ids('route53')[0]).toBe('aws-route53');
  });
  it('finds the services architecture diagrams reach for', () => {
    expect(ids('elasticache')[0]).toBe('aws-elasticache');
    expect(ids('fargate')[0]).toBe('aws-fargate');
    expect(ids('application load balancer')).toContain('aws-elb');
    expect(ids('browser')[0]).toBe('browser');
  });

  it('finds a Technology icon by its provider and id words, and an id as given', () => {
    for (const q of ['aws lambda', 'aws-lambda', 'aws rds', 'aws s3', 'aws sqs'])
      expect(searchIcons(q, 1).icons[0]!.id).toBe(q.replace(' ', '-'));
  });

  it('puts an emoji after the line-art icon answering as well', () => {
    const ids = searchIcons('rocket', 5).icons.map((i) => i.id);
    expect(ids.indexOf('rocket')).toBeLessThan(ids.indexOf('emoji-rocket'));
  });
});
