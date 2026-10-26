import {
  DEFAULT_UNIT_PREFS,
  type ProfileStore,
  type StoreSnapshot,
  type StoredLoad,
  type StoredRifle,
  type UnitPrefs,
} from './types';

const KEYS = {
  rifles: 'bf.rifles.v1',
  loads: 'bf.loads.v1',
  prefs: 'bf.prefs.v1',
} as const;

/**
 * A localStorage-backed store. Used for guest mode and as the offline draft
 * store. Reads never throw: a corrupt or unavailable store degrades to empty
 * rather than taking the calculator down with it.
 */
export class LocalStore implements ProfileStore {
  readonly kind = 'local' as const;

  constructor(private readonly storage: Storage | null = safeStorage()) {}

  private read<T>(key: string, fallback: T): T {
    if (!this.storage) return fallback;
    try {
      const raw = this.storage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private write(key: string, value: unknown): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(key, JSON.stringify(value));
    } catch {
      // Quota or private-mode failure: the in-session UI still works.
    }
  }

  listRifles(): Promise<StoredRifle[]> {
    return Promise.resolve(this.read<StoredRifle[]>(KEYS.rifles, []));
  }

  async getRifle(id: string): Promise<StoredRifle | null> {
    const rifles = await this.listRifles();
    return rifles.find((r) => r.id === id) ?? null;
  }

  async saveRifle(rifle: StoredRifle): Promise<StoredRifle> {
    const rifles = await this.listRifles();
    const index = rifles.findIndex((r) => r.id === rifle.id);
    if (index === -1) rifles.push(rifle);
    else rifles[index] = rifle;
    this.write(KEYS.rifles, rifles);
    return rifle;
  }

  async deleteRifle(id: string): Promise<void> {
    const rifles = (await this.listRifles()).filter((r) => r.id !== id);
    this.write(KEYS.rifles, rifles);
    // Loads belong to a rifle; orphans would be unreachable.
    const loads = (await this.listLoads()).filter((l) => l.rifleId !== id);
    this.write(KEYS.loads, loads);
  }

  listLoads(rifleId?: string): Promise<StoredLoad[]> {
    const all = this.read<StoredLoad[]>(KEYS.loads, []);
    return Promise.resolve(rifleId === undefined ? all : all.filter((l) => l.rifleId === rifleId));
  }

  async getLoad(id: string): Promise<StoredLoad | null> {
    const loads = await this.listLoads();
    return loads.find((l) => l.id === id) ?? null;
  }

  async saveLoad(load: StoredLoad): Promise<StoredLoad> {
    const loads = await this.listLoads();
    const index = loads.findIndex((l) => l.id === load.id);
    if (index === -1) loads.push(load);
    else loads[index] = load;
    this.write(KEYS.loads, loads);
    return load;
  }

  async deleteLoad(id: string): Promise<void> {
    const loads = (await this.listLoads()).filter((l) => l.id !== id);
    this.write(KEYS.loads, loads);
  }

  getPrefs(): Promise<UnitPrefs> {
    return Promise.resolve({
      ...DEFAULT_UNIT_PREFS,
      ...this.read<Partial<UnitPrefs>>(KEYS.prefs, {}),
    });
  }

  savePrefs(prefs: UnitPrefs): Promise<UnitPrefs> {
    this.write(KEYS.prefs, prefs);
    return Promise.resolve(prefs);
  }

  async exportAll(): Promise<StoreSnapshot> {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      rifles: await this.listRifles(),
      loads: await this.listLoads(),
      prefs: await this.getPrefs(),
    };
  }

  importAll(snapshot: StoreSnapshot): Promise<void> {
    this.write(KEYS.rifles, snapshot.rifles);
    this.write(KEYS.loads, snapshot.loads);
    this.write(KEYS.prefs, snapshot.prefs);
    return Promise.resolve();
  }

  clearAll(): Promise<void> {
    if (this.storage) {
      for (const key of Object.values(KEYS)) {
        try {
          this.storage.removeItem(key);
        } catch {
          // Ignore: nothing we can do, and nothing depends on it.
        }
      }
    }
    return Promise.resolve();
  }

  /** True when there is guest data worth offering to migrate into an account. */
  async hasData(): Promise<boolean> {
    const [rifles, loads] = await Promise.all([this.listRifles(), this.listLoads()]);
    return rifles.length > 0 || loads.length > 0;
  }
}

function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    // Private browsing can throw on access, not just on write.
    const probe = '__bf_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}
