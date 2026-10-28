import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, seedUserData, type TestDb } from './helpers.ts';

/**
 * Row-level security, exercised against the real policies.
 *
 * The headline requirement from the brief is "user A cannot read user B's
 * sessions". That is the first test here; the rest cover the ways that
 * guarantee usually gets lost — writes that forge a user_id, an anonymous
 * reader, privilege escalation through the profile row, and the phased reveal
 * of community aggregates.
 */

let test: TestDb;
let alice: string;
let bob: string;
let admin: string;
let aliceData: Awaited<ReturnType<typeof seedUserData>>;
let bobData: Awaited<ReturnType<typeof seedUserData>>;

beforeAll(async () => {
  test = await createTestDb();
  alice = await test.createUser('alice@example.com');
  bob = await test.createUser('bob@example.com');
  admin = await test.createUser('admin@example.com');
  await test.makeAdmin(admin);

  aliceData = await seedUserData(test, alice, 'alice');
  bobData = await seedUserData(test, bob, 'bob');

  // One reference row and one aggregate, so the public/gated reads have
  // something to find or fail to find.
  await test.db.exec(`
    insert into public.manufacturers (name, type) values ('Hornady', 'bullet');
    insert into public.cartridges (name, bullet_diameter_in, source_url)
      values ('6.5 Creedmoor', 0.264, 'https://example.com/6.5cm');
    insert into public.bullets (manufacturer_id, name, diameter_in, weight_gr, bc_g7, source_url)
      select id, '140 ELD-M', 0.264, 140, 0.326, 'https://example.com/eldm'
      from public.manufacturers where name = 'Hornady';
    insert into public.field_aggregates (group_key, bullet_id, n_shots, n_sessions, n_users, mv_mean)
      select 'test-group', id, 500, 12, 7, 2673
      from public.bullets where name = '140 ELD-M';
  `);
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('user data is owner-only', () => {
  it('user A cannot read user B’s sessions', async () => {
    const rows = await test.asUser(alice, async () => {
      const result = await test.db.query<{ id: string }>('select id from public.sessions');
      return result.rows;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(aliceData.sessionId);
    expect(rows.map((r) => r.id)).not.toContain(bobData.sessionId);
  });

  it('user A cannot read user B’s session even when naming its id', async () => {
    const rows = await test.asUser(alice, async () => {
      const result = await test.db.query('select id from public.sessions where id = $1', [
        bobData.sessionId,
      ]);
      return result.rows;
    });
    expect(rows).toEqual([]);
  });

  it('isolates rifles, loads and shot strings the same way', async () => {
    const counts = await test.asUser(bob, async () => {
      const rifles = await test.db.query('select id from public.rifles');
      const loads = await test.db.query('select id from public.loads');
      const strings = await test.db.query('select id from public.shot_strings');
      return {
        rifles: rifles.rows.length,
        loads: loads.rows.length,
        strings: strings.rows.length,
      };
    });
    expect(counts).toEqual({ rifles: 1, loads: 1, strings: 1 });
  });

  it('lets a user read their own data', async () => {
    const rows = await test.asUser(bob, async () => {
      const result = await test.db.query<{ id: string }>('select id from public.sessions');
      return result.rows;
    });
    expect(rows[0]?.id).toBe(bobData.sessionId);
  });

  it('refuses a write that forges another user’s id', async () => {
    await expect(
      test.asUser(alice, () =>
        test.db.query(
          `insert into public.rifles (user_id, name, sight_height_in, zero_range_yd)
           values ($1, 'Forged', 1.9, 100)`,
          [bob],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('refuses an update aimed at another user’s row', async () => {
    const result = await test.asUser(alice, () =>
      test.db.query(`update public.rifles set name = 'Stolen' where id = $1`, [bobData.rifleId]),
    );
    // The row is invisible, so the update matches nothing rather than erroring.
    expect(result.affectedRows).toBe(0);
  });

  it('refuses a delete aimed at another user’s row', async () => {
    const result = await test.asUser(alice, () =>
      test.db.query('delete from public.sessions where id = $1', [bobData.sessionId]),
    );
    expect(result.affectedRows).toBe(0);
  });
});

describe('anonymous visitors', () => {
  it('see no user data at all', async () => {
    const counts = await test.asAnon(async () => {
      const sessions = await test.db.query('select id from public.sessions');
      const rifles = await test.db.query('select id from public.rifles');
      return { sessions: sessions.rows.length, rifles: rifles.rows.length };
    });
    expect(counts).toEqual({ sessions: 0, rifles: 0 });
  });

  it('can read the reference library', async () => {
    const rows = await test.asAnon(async () => {
      const result = await test.db.query<{ name: string }>('select name from public.bullets');
      return result.rows;
    });
    expect(rows.map((r) => r.name)).toContain('140 ELD-M');
  });

  it('cannot write to the reference library', async () => {
    await expect(
      test.asAnon(() =>
        test.db.query(
          `insert into public.cartridges (name, bullet_diameter_in, source_url)
           values ('Fake', 0.308, 'https://example.com')`,
        ),
      ),
    ).rejects.toThrow();
  });

  it('can join the waitlist but cannot read it', async () => {
    await test.asAnon(() =>
      test.db.query('insert into public.waitlist (email) values ($1)', ['new@example.com']),
    );
    const rows = await test.asAnon(async () => {
      const result = await test.db.query('select email from public.waitlist');
      return result.rows;
    });
    expect(rows).toEqual([]);
  });
});

describe('field aggregates follow the reveal flag', () => {
  it('are hidden from a signed-in user while the flag is off', async () => {
    const rows = await test.asUser(alice, async () => {
      const result = await test.db.query('select group_key from public.field_aggregates');
      return result.rows;
    });
    expect(rows).toEqual([]);
  });

  it('are hidden from anonymous visitors while the flag is off', async () => {
    const rows = await test.asAnon(async () => {
      const result = await test.db.query('select group_key from public.field_aggregates');
      return result.rows;
    });
    expect(rows).toEqual([]);
  });

  it('are visible to an admin before the reveal', async () => {
    const rows = await test.asUser(admin, async () => {
      const result = await test.db.query<{ group_key: string }>(
        'select group_key from public.field_aggregates',
      );
      return result.rows;
    });
    expect(rows.map((r) => r.group_key)).toEqual(['test-group']);
  });

  it('become visible to everyone once the flag is switched on', async () => {
    await test.db.query(`update public.app_flags set value = 'true'::jsonb where key = $1`, [
      'field_data_public',
    ]);
    try {
      const rows = await test.asAnon(async () => {
        const result = await test.db.query<{ group_key: string }>(
          'select group_key from public.field_aggregates',
        );
        return result.rows;
      });
      expect(rows.map((r) => r.group_key)).toEqual(['test-group']);
    } finally {
      await test.db.query(`update public.app_flags set value = 'false'::jsonb where key = $1`, [
        'field_data_public',
      ]);
    }
  });
});

describe('admins', () => {
  it('can read every session for the review queue', async () => {
    const rows = await test.asUser(admin, async () => {
      const result = await test.db.query<{ id: string }>('select id from public.sessions');
      return result.rows;
    });
    expect(rows.map((r) => r.id)).toEqual(
      expect.arrayContaining([aliceData.sessionId, bobData.sessionId]),
    );
  });

  it('still cannot edit someone else’s session', async () => {
    const result = await test.asUser(admin, () =>
      test.db.query(`update public.sessions set notes = 'edited' where id = $1`, [
        aliceData.sessionId,
      ]),
    );
    expect(result.affectedRows).toBe(0);
  });

  it('can write reference data', async () => {
    await test.asUser(admin, () =>
      test.db.query(
        `insert into public.cartridges (name, bullet_diameter_in, source_url)
         values ('.308 Winchester', 0.308, 'https://example.com/308')`,
      ),
    );
    const { rows } = await test.db.query<{ count: number }>(
      `select count(*)::int as count from public.cartridges where name = '.308 Winchester'`,
    );
    expect(rows[0]?.count).toBe(1);
  });
});

describe('privilege escalation', () => {
  it('stops a user promoting themselves to admin', async () => {
    await expect(
      test.asUser(alice, () =>
        test.db.query(`update public.profiles set role = 'admin' where user_id = $1`, [alice]),
      ),
    ).rejects.toThrow(/only an admin can change a profile role/i);
  });

  it('stops a user clearing their own flagged status', async () => {
    await test.db.query('update public.profiles set flagged = true where user_id = $1', [alice]);
    await expect(
      test.asUser(alice, () =>
        test.db.query('update public.profiles set flagged = false where user_id = $1', [alice]),
      ),
    ).rejects.toThrow(/only an admin can flag an account/i);
    await test.db.query('update public.profiles set flagged = false where user_id = $1', [alice]);
  });

  it('lets a user change their own harmless profile fields', async () => {
    await test.asUser(alice, () =>
      test.db.query('update public.profiles set display_name = $1 where user_id = $2', [
        'Alice',
        alice,
      ]),
    );
    const { rows } = await test.db.query<{ display_name: string }>(
      'select display_name from public.profiles where user_id = $1',
      [alice],
    );
    expect(rows[0]?.display_name).toBe('Alice');
  });

  it('stops a user reading another profile', async () => {
    const rows = await test.asUser(alice, async () => {
      const result = await test.db.query('select user_id from public.profiles where user_id = $1', [
        bob,
      ]);
      return result.rows;
    });
    expect(rows).toEqual([]);
  });

  it('stops a user granting themselves an entitlement', async () => {
    await expect(
      test.asUser(alice, () =>
        test.db.query(`insert into public.entitlements (user_id, tier) values ($1, 'pro')`, [
          alice,
        ]),
      ),
    ).rejects.toThrow();
  });
});

describe('account deletion', () => {
  it('takes every owned row with it', async () => {
    const doomed = await test.createUser('doomed@example.com');
    await seedUserData(test, doomed, 'doomed');

    await test.db.query('delete from auth.users where id = $1', [doomed]);

    for (const table of ['rifles', 'loads', 'sessions', 'shot_strings', 'profiles']) {
      const column = table === 'profiles' ? 'user_id' : 'user_id';
      const { rows } = await test.db.query<{ count: number }>(
        `select count(*)::int as count from public.${table} where ${column} = $1`,
        [doomed],
      );
      expect(rows[0]?.count, table).toBe(0);
    }
  });
});
