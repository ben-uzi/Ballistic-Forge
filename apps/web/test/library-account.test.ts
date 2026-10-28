import { describe, expect, it } from 'vitest';
import { exportCsvBundle, exportJson } from '@/lib/account/export';
import {
  BULLETS,
  calibreOptions,
  findBullet,
  manufacturerOptions,
  preferredBc,
  searchBullets,
} from '@/lib/library';
import {
  newLoad,
  newRifle,
  newSession,
  newShotString,
  newSuppressor,
  type Clock,
} from '@/lib/store/factories';
import { DEFAULT_UNIT_PREFS, type StoreSnapshot } from '@/lib/store/types';

describe('the bundled library', () => {
  it('ships the seeded bullets', () => {
    expect(BULLETS.length).toBeGreaterThanOrEqual(25);
  });

  it('gives every bullet a source and at least one BC', () => {
    for (const bullet of BULLETS) {
      expect(bullet.sourceUrl, bullet.name).toMatch(/^https?:\/\//);
      expect(bullet.bcG1 ?? bullet.bcG7, bullet.name).not.toBeNull();
    }
  });

  it('marks nothing as verified, because no human has checked it', () => {
    expect(BULLETS.every((bullet) => !bullet.verified)).toBe(true);
  });

  it('has no duplicate ids', () => {
    const ids = BULLETS.map((bullet) => bullet.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('prefers G7 where the maker publishes one', () => {
    const bullet = BULLETS.find((entry) => entry.bcG7 !== null);
    if (bullet === undefined) throw new Error('The library has no G7 bullet to test with');
    expect(preferredBc(bullet)?.type).toBe('G7');
  });

  it('falls back to G1 when there is no G7', () => {
    expect(
      preferredBc({
        id: 'x',
        manufacturer: 'M',
        name: 'N',
        diameterIn: 0.308,
        weightGr: 168,
        lengthIn: null,
        bcG1: 0.462,
        bcG7: null,
        sourceUrl: 'https://example.com',
        verified: false,
      }),
    ).toEqual({ type: 'G1', value: 0.462 });
  });

  it('has nothing to offer a bullet with no BC at all', () => {
    expect(
      preferredBc({
        id: 'x',
        manufacturer: 'M',
        name: 'N',
        diameterIn: 0.308,
        weightGr: 168,
        lengthIn: null,
        bcG1: null,
        bcG7: null,
        sourceUrl: 'https://example.com',
        verified: false,
      }),
    ).toBeNull();
  });
});

describe('searching the library', () => {
  it('returns everything with no filter', () => {
    expect(searchBullets({})).toHaveLength(BULLETS.length);
  });

  it('matches words in any order', () => {
    const a = searchBullets({ query: 'eld 140' });
    const b = searchBullets({ query: '140 eld' });
    expect(a.length).toBeGreaterThan(0);
    expect(a).toEqual(b);
  });

  it('matches the manufacturer as well as the name', () => {
    expect(searchBullets({ query: 'berger' }).length).toBeGreaterThan(0);
  });

  it('filters by calibre', () => {
    const results = searchBullets({ diameterIn: '0.264' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((bullet) => bullet.diameterIn === 0.264)).toBe(true);
  });

  it('filters by weight range', () => {
    const results = searchBullets({ minWeightGr: 150, maxWeightGr: 200 });
    expect(results.every((bullet) => bullet.weightGr >= 150 && bullet.weightGr <= 200)).toBe(true);
  });

  it('filters to bullets that publish a given BC type', () => {
    expect(searchBullets({ bcType: 'G7' }).every((bullet) => bullet.bcG7 !== null)).toBe(true);
  });

  it('returns nothing rather than everything for a hopeless search', () => {
    expect(searchBullets({ query: 'zzzzz' })).toEqual([]);
  });

  it('finds a bullet by id and nothing by a bad one', () => {
    const first = BULLETS[0];
    if (first === undefined) throw new Error('The library is empty');
    expect(findBullet(first.id)?.id).toBe(first.id);
    expect(findBullet('nope')).toBeNull();
  });

  it('derives the filter options from the data', () => {
    expect(calibreOptions().length).toBeGreaterThan(1);
    expect(manufacturerOptions().map((option) => option.value)).toContain('Hornady');
  });
});

describe('data export', () => {
  let n = 0;
  const clock: Clock = { now: () => '2026-06-01T00:00:00.000Z', id: () => `id${String((n += 1))}` };

  const rifle = newRifle({ name: 'Tikka', cartridge: '6.5 Creedmoor', barrelLengthIn: 24 }, clock);
  const load = newLoad(rifle.id, { name: '140 ELD-M' }, clock);
  const can = newSuppressor({ name: 'Nomad-30', ratedCartridges: ['.308 Winchester'] }, clock);
  const session = newSession(
    rifle.id,
    load.id,
    {
      strings: [newShotString({ velocitiesFps: [2690, 2695, 2688] }, clock)],
    },
    clock,
  );

  const snapshot: StoreSnapshot = {
    version: 1,
    exportedAt: '2026-06-01T00:00:00.000Z',
    rifles: [rifle],
    loads: [load],
    suppressors: [can],
    suppressorSetups: [],
    sessions: [session],
    prefs: DEFAULT_UNIT_PREFS,
  };

  it('writes JSON that parses back to the same snapshot', () => {
    expect(JSON.parse(exportJson(snapshot))).toEqual(snapshot);
  });

  it('writes a CSV section per table', () => {
    const csv = exportCsvBundle(snapshot);
    expect(csv).toContain('# rifles');
    expect(csv).toContain('# loads');
    expect(csv).toContain('# suppressors');
    expect(csv).toContain('# shot_strings');
  });

  it('puts one CSV row per string, not per session', () => {
    const csv = exportCsvBundle(snapshot);
    const block = csv.slice(csv.indexOf('# shot_strings'));
    // Header plus one row.
    expect(block.trim().split('\n')).toHaveLength(3);
    expect(block).toContain('2690 2695 2688');
  });

  it('says "none" rather than emitting an empty section', () => {
    const empty: StoreSnapshot = { ...snapshot, suppressors: [], sessions: [] };
    const csv = exportCsvBundle(empty);
    expect(csv).toContain('# suppressors: none');
    expect(csv).toContain('# shot_strings: none');
  });

  it('leaves unknown values blank instead of writing undefined', () => {
    const csv = exportCsvBundle(snapshot);
    expect(csv).not.toContain('undefined');
    expect(csv).not.toContain('null');
  });

  it('stamps the export date', () => {
    expect(exportCsvBundle(snapshot)).toContain('2026-06-01');
  });
});
