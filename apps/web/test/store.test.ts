import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStore } from '@/lib/store/local';
import { SupabaseStore, SupabaseStoreNotReadyError } from '@/lib/store/supabase';
import { DEFAULT_UNIT_PREFS, type StoredLoad, type StoredRifle } from '@/lib/store/types';

const rifle = (id: string): StoredRifle => ({
  id,
  name: `Rifle ${id}`,
  cartridge: '6.5 Creedmoor',
  twistDirection: 'right',
  sightHeightIn: 1.9,
  zeroRangeYd: 100,
  angularUnit: 'mil',
  elevationClickKey: 'mil_0_1',
  windageClickKey: 'mil_0_1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const load = (id: string, rifleId: string): StoredLoad => ({
  id,
  rifleId,
  name: `Load ${id}`,
  bullet: {
    name: '140 ELD-M',
    diameterIn: 0.264,
    weightGr: 140,
    bcType: 'G7',
    bcValue: 0.326,
    verified: false,
  },
  muzzleVelocityFps: 2690,
  muzzleVelocitySource: 'advertised',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('LocalStore', () => {
  let store: LocalStore;

  beforeEach(() => {
    window.localStorage.clear();
    store = new LocalStore();
  });

  it('starts empty', async () => {
    expect(await store.listRifles()).toEqual([]);
    expect(await store.listLoads()).toEqual([]);
    expect(await store.hasData()).toBe(false);
  });

  it('saves and reads back a rifle', async () => {
    await store.saveRifle(rifle('a'));
    expect(await store.getRifle('a')).toMatchObject({ name: 'Rifle a' });
    expect(await store.hasData()).toBe(true);
  });

  it('updates in place rather than duplicating', async () => {
    await store.saveRifle(rifle('a'));
    await store.saveRifle({ ...rifle('a'), name: 'Renamed' });
    const rifles = await store.listRifles();
    expect(rifles).toHaveLength(1);
    expect(rifles[0]?.name).toBe('Renamed');
  });

  it('filters loads by rifle', async () => {
    await store.saveLoad(load('l1', 'a'));
    await store.saveLoad(load('l2', 'b'));
    expect(await store.listLoads('a')).toHaveLength(1);
    expect(await store.listLoads()).toHaveLength(2);
  });

  it('deletes a rifle together with its loads, leaving no orphans', async () => {
    await store.saveRifle(rifle('a'));
    await store.saveLoad(load('l1', 'a'));
    await store.saveLoad(load('l2', 'b'));

    await store.deleteRifle('a');
    expect(await store.getRifle('a')).toBeNull();
    expect(await store.listLoads()).toHaveLength(1);
    expect(await store.listLoads('b')).toHaveLength(1);
  });

  it('returns default preferences before any are saved', async () => {
    expect(await store.getPrefs()).toEqual(DEFAULT_UNIT_PREFS);
  });

  it('merges saved preferences over the defaults', async () => {
    await store.savePrefs({ ...DEFAULT_UNIT_PREFS, range: 'm' });
    expect(await store.getPrefs()).toMatchObject({ range: 'm', velocity: 'fps' });
  });

  it('round-trips an export through an import', async () => {
    await store.saveRifle(rifle('a'));
    await store.saveLoad(load('l1', 'a'));
    const snapshot = await store.exportAll();

    await store.clearAll();
    expect(await store.listRifles()).toEqual([]);

    await store.importAll(snapshot);
    expect(await store.listRifles()).toHaveLength(1);
    expect(await store.listLoads()).toHaveLength(1);
  });

  it('degrades to empty rather than throwing on corrupt storage', async () => {
    window.localStorage.setItem('bf.rifles.v1', '{not json');
    expect(await store.listRifles()).toEqual([]);
  });

  it('works with no storage at all', async () => {
    const headless = new LocalStore(null);
    await headless.saveRifle(rifle('a'));
    expect(await headless.listRifles()).toEqual([]);
    await expect(headless.clearAll()).resolves.toBeUndefined();
  });
});

describe('SupabaseStore', () => {
  it('fails loudly instead of pretending to be an empty account', async () => {
    const store = new SupabaseStore();
    expect(store.kind).toBe('supabase');
    await expect(async () => store.listRifles()).rejects.toThrow(SupabaseStoreNotReadyError);
  });
});
