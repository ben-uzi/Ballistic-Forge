import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './helpers.ts';
import { CsvError, parseCsv, parseCsvCells, toCsv } from '../src/csv.ts';
import { SEED_DIR } from '../src/migrations.ts';
import { SEED_ORDER } from '../src/schemas.ts';
import { buildSeed, toVerifyRows, type SeedInput } from '../src/seed.ts';

describe('CSV parsing', () => {
  it('reads a header and rows', () => {
    expect(parseCsv('a,b\n1,2\n3,4\n')).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('handles quoted fields with commas, quotes and newlines', () => {
    const text = 'name,note\n"Smith, John","He said ""hi""\nagain"\n';
    expect(parseCsv(text)).toEqual([{ name: 'Smith, John', note: 'He said "hi"\nagain' }]);
  });

  it('treats a lone dash as not provided', () => {
    expect(parseCsv('a,b\n1,-\n')).toEqual([{ a: '1', b: '' }]);
  });

  it('tolerates CRLF line endings', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([{ a: '1', b: '2' }]);
  });

  it('ignores a trailing newline rather than inventing a row', () => {
    expect(parseCsv('a\n1\n\n')).toEqual([{ a: '1' }]);
  });

  it('rejects a ragged row', () => {
    expect(() => parseCsv('a,b\n1\n')).toThrow(CsvError);
  });

  it('rejects duplicate columns', () => {
    expect(() => parseCsv('a,a\n1,2\n')).toThrow(/Duplicate column/);
  });

  it('rejects an unterminated quoted field', () => {
    expect(() => parseCsvCells('a\n"unclosed')).toThrow(/ended inside a quoted field/);
  });

  it('round-trips through the writer', () => {
    const rows = [{ name: 'Smith, John', note: 'He said "hi"' }];
    expect(parseCsv(toCsv(['name', 'note'], rows))).toEqual(rows);
  });
});

describe('seed validation', () => {
  const manufacturers = [
    { name: 'Hornady', type: 'bullet', website_url: 'https://www.hornady.com' },
    { name: 'Hornady', type: 'ammo', website_url: 'https://www.hornady.com' },
  ];
  const cartridges = [
    {
      name: '6.5 Creedmoor',
      bullet_diameter_in: '0.264',
      saami_max_pressure_psi: '62000',
      source_url: 'https://example.com/6.5cm',
      notes: '',
    },
  ];
  const bullet = {
    manufacturer: 'Hornady',
    name: '140 gr ELD-M',
    diameter_in: '0.264',
    weight_gr: '140',
    length_in: '1.345',
    bc_g1: '0.646',
    bc_g7: '0.326',
    source_url: 'https://example.com/eldm',
    notes: '',
  };
  const bullets = [bullet];

  it('accepts a well-formed set', () => {
    const result = buildSeed({ manufacturers, cartridges, bullets });
    expect(result.rejected).toEqual([]);
    expect(result.accepted).toMatchObject({ manufacturers: 2, cartridges: 1, bullets: 1 });
  });

  it('rejects any row without a source_url', () => {
    const result = buildSeed({
      manufacturers,
      bullets: [{ ...bullet, source_url: '' }],
    });
    expect(result.rejected[0]?.message).toMatch(/source_url is required/);
    expect(result.accepted.bullets).toBe(0);
  });

  it('rejects a source that is not a real URL', () => {
    const result = buildSeed({
      manufacturers,
      bullets: [{ ...bullet, source_url: 'manufacturer website' }],
    });
    expect(result.rejected[0]?.message).toMatch(/full http\(s\) URL/);
  });

  it('rejects an implausible ballistic coefficient', () => {
    const result = buildSeed({
      manufacturers,
      bullets: [{ ...bullet, bc_g1: '3.4', bc_g7: '' }],
    });
    expect(result.rejected[0]?.message).toMatch(/bc_g1 must be between/);
  });

  it('catches G1 and G7 entered in the wrong columns', () => {
    const result = buildSeed({
      manufacturers,
      bullets: [{ ...bullet, bc_g1: '0.326', bc_g7: '0.646' }],
    });
    expect(result.rejected[0]?.message).toMatch(/columns look swapped/);
  });

  it('rejects a bullet with no ballistic coefficient', () => {
    const result = buildSeed({
      manufacturers,
      bullets: [{ ...bullet, bc_g1: '', bc_g7: '' }],
    });
    expect(result.rejected[0]?.message).toMatch(/needs at least one ballistic coefficient/);
  });

  it('rejects a bullet whose manufacturer is not in manufacturers.csv', () => {
    const result = buildSeed({
      manufacturers: [],
      bullets,
    });
    expect(result.rejected[0]?.message).toMatch(/No manufacturer named "Hornady"/);
  });

  it('rejects a factory load whose bullet diameter contradicts its cartridge', () => {
    const result = buildSeed({
      manufacturers,
      cartridges,
      bullets: [{ ...bullet, diameter_in: '0.308', name: 'Wrong calibre' }],
      factory_loads: [
        {
          manufacturer: 'Hornady',
          cartridge: '6.5 Creedmoor',
          bullet: 'Wrong calibre',
          product_name: 'Match',
          sku: '',
          advertised_mv_fps: '2710',
          test_barrel_in: '24',
          source_url: 'https://example.com/match',
          notes: '',
        },
      ],
    });
    expect(result.rejected.some((i) => /does not match/.test(i.message))).toBe(true);
    expect(result.accepted.factory_loads).toBe(0);
  });

  it('reports the row number so a human can find it', () => {
    const result = buildSeed({
      manufacturers,
      bullets: [bullet, { ...bullet, name: 'Bad', source_url: '' }],
    });
    expect(result.rejected[0]?.row).toBe(2);
  });

  it('turns rejects into to_verify rows that keep the original data', () => {
    const result = buildSeed({
      manufacturers,
      bullets: [{ ...bullet, source_url: '' }],
    });
    const rows = toVerifyRows(result.rejected);
    expect(rows[0]).toMatchObject({ file: 'bullets', name: '140 gr ELD-M' });
    expect(rows[0]?.problem).toMatch(/source_url/);
  });
});

describe('generated seed SQL', () => {
  let test: TestDb;

  beforeAll(async () => {
    test = await createTestDb();
  }, 60_000);

  afterAll(async () => {
    await test?.close();
  });

  const full = {
    manufacturers: [
      { name: 'Hornady', type: 'bullet', website_url: 'https://www.hornady.com' },
      { name: 'Hornady', type: 'ammo', website_url: 'https://www.hornady.com' },
      { name: 'Dead Air', type: 'suppressor', website_url: 'https://deadairsilencers.com' },
    ],
    cartridges: [
      {
        name: '6.5 Creedmoor',
        bullet_diameter_in: '0.264',
        saami_max_pressure_psi: '62000',
        source_url: 'https://example.com/6.5cm',
        notes: '',
      },
    ],
    bullets: [
      {
        manufacturer: 'Hornady',
        name: '140 gr ELD-M',
        diameter_in: '0.264',
        weight_gr: '140',
        length_in: '1.345',
        bc_g1: '0.646',
        bc_g7: '0.326',
        source_url: 'https://example.com/eldm',
        notes: "O'Connor's note with a quote",
      },
    ],
    factory_loads: [
      {
        manufacturer: 'Hornady',
        cartridge: '6.5 Creedmoor',
        bullet: '140 gr ELD-M',
        product_name: 'Match 140 gr ELD-M',
        sku: '81500',
        advertised_mv_fps: '2710',
        test_barrel_in: '24',
        source_url: 'https://example.com/match',
        notes: '',
      },
    ],
    suppressors: [
      {
        manufacturer: 'Dead Air',
        model: 'Nomad-30',
        mount_type: 'direct_thread',
        thread_pitch: '5/8x24',
        bore_diameter_in: '0.308',
        max_rated_cartridge: '.300 Win Mag',
        rated_cartridges: '.308 Winchester; 6.5 Creedmoor; .300 Win Mag',
        length_in: '6.9',
        diameter_in: '1.735',
        weight_oz: '16.8',
        min_barrel_length_note: '16 in minimum for .300 Win Mag',
        full_auto_rated: 'no',
        source_url: 'https://example.com/nomad',
        notes: '',
      },
    ],
  };

  it('applies cleanly to the real schema', async () => {
    const { sql, rejected } = buildSeed(full);
    expect(rejected).toEqual([]);
    await test.db.exec(sql);

    const counts = await test.db.query<{ t: string; n: number }>(`
      select 'manufacturers' as t, count(*)::int as n from public.manufacturers
      union all select 'cartridges', count(*)::int from public.cartridges
      union all select 'bullets', count(*)::int from public.bullets
      union all select 'factory_loads', count(*)::int from public.factory_loads
      union all select 'suppressors', count(*)::int from public.suppressors
      order by t
    `);
    expect(Object.fromEntries(counts.rows.map((r) => [r.t, r.n]))).toEqual({
      manufacturers: 3,
      cartridges: 1,
      bullets: 1,
      factory_loads: 1,
      suppressors: 1,
    });
  });

  it('resolves foreign keys rather than leaving them null', async () => {
    const { rows } = await test.db.query<{ manufacturer: string; cartridge: string }>(`
      select m.name as manufacturer, c.name as cartridge
      from public.factory_loads f
      join public.manufacturers m on m.id = f.manufacturer_id
      join public.cartridges c on c.id = f.cartridge_id
    `);
    expect(rows[0]).toEqual({ manufacturer: 'Hornady', cartridge: '6.5 Creedmoor' });

    const bulletLink = await test.db.query<{ n: number }>(
      `select count(*)::int as n from public.factory_loads where bullet_id is not null`,
    );
    expect(bulletLink.rows[0]?.n).toBe(1);
  });

  it('stores rated cartridges as a real array', async () => {
    const { rows } = await test.db.query<{ rated_cartridges: string[] }>(
      `select rated_cartridges from public.suppressors where model = 'Nomad-30'`,
    );
    expect(rows[0]?.rated_cartridges).toEqual(['.308 Winchester', '6.5 Creedmoor', '.300 Win Mag']);
  });

  it('escapes quotes in text instead of breaking the statement', async () => {
    const { rows } = await test.db.query<{ notes: string }>(
      `select notes from public.bullets where name = '140 gr ELD-M'`,
    );
    expect(rows[0]?.notes).toBe("O'Connor's note with a quote");
  });

  it('is idempotent: applying it twice changes nothing', async () => {
    const { sql } = buildSeed(full);
    await test.db.exec(sql);
    const { rows } = await test.db.query<{ n: number }>(
      `select count(*)::int as n from public.bullets`,
    );
    expect(rows[0]?.n).toBe(1);
  });

  it('leaves everything unverified until a human says otherwise', async () => {
    const { rows } = await test.db.query<{ n: number }>(
      `select count(*)::int as n from public.bullets where verified = true`,
    );
    expect(rows[0]?.n).toBe(0);
  });
});

describe('the seed files actually shipped', () => {
  let test: TestDb;

  beforeAll(async () => {
    test = await createTestDb();
  }, 60_000);

  afterAll(async () => {
    await test?.close();
  });

  const load = (): SeedInput => {
    const input: Record<string, ReturnType<typeof parseCsv>> = {};
    for (const file of SEED_ORDER) {
      const path = join(SEED_DIR, `${file}.csv`);
      if (existsSync(path)) input[file] = parseCsv(readFileSync(path, 'utf8'));
    }
    return input satisfies SeedInput;
  };

  it('validate with no rejected rows', () => {
    const { rejected } = buildSeed(load());
    // Anything that cannot be sourced belongs in to_verify.csv, not in here.
    expect(rejected).toEqual([]);
  });

  it('apply to the real schema', async () => {
    const { sql } = buildSeed(load());
    await test.db.exec(sql);
    const { rows } = await test.db.query<{ n: number }>(
      'select count(*)::int as n from public.bullets',
    );
    expect(rows[0]?.n).toBeGreaterThanOrEqual(25);
  });

  it('cite a real manufacturer URL on every reference row', async () => {
    for (const table of ['cartridges', 'bullets', 'factory_loads', 'suppressors']) {
      const { rows } = await test.db.query<{ n: number }>(
        `select count(*)::int as n from public.${table} where source_url !~ '^https?://'`,
      );
      expect(rows[0]?.n, table).toBe(0);
    }
  });

  it('ship nothing marked verified — that is a human\u2019s call', async () => {
    const { rows } = await test.db.query<{ n: number }>(
      `select count(*)::int as n from public.bullets where verified = true`,
    );
    expect(rows[0]?.n).toBe(0);
  });

  it('give every bullet a usable ballistic coefficient', async () => {
    const { rows } = await test.db.query<{ n: number }>(
      `select count(*)::int as n from public.bullets
       where bc_g1 is null and bc_g7 is null and bc_bands is null`,
    );
    expect(rows[0]?.n).toBe(0);
  });

  it('keep the generated seed.sql in step with the CSVs', () => {
    const generated = buildSeed(load()).sql;
    const onDisk = readFileSync(join(SEED_DIR, 'seed.sql'), 'utf8');
    // If this fails, someone edited a CSV without re-running `pnpm seed`.
    expect(onDisk).toBe(generated);
  });
});
