'use client';

import { useCallback, useEffect, useState } from 'react';
import { getStore } from './index';
import type { StoredLoad, StoredRifle } from './types';

/**
 * React access to the profile store.
 *
 * The store is async because it will be Supabase one day; today it is
 * localStorage and resolves immediately. `loading` starts true so the first
 * render matches the server's (nothing yet) and hydration stays clean.
 */

interface Query<T> {
  readonly data: T;
  readonly loading: boolean;
  readonly refresh: () => void;
}

function useQuery<T>(run: () => Promise<T>, initial: T, deps: readonly unknown[]): Query<T> {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void run().then((result) => {
      if (cancelled) return;
      setData(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // `run` is recreated every render by design, so the caller's deps drive this.
  }, [nonce, ...deps]);

  const refresh = useCallback(() => {
    setNonce((value) => value + 1);
  }, []);

  return { data, loading, refresh };
}

export function useRifles(): Query<StoredRifle[]> {
  return useQuery(() => getStore().listRifles(), [], []);
}

export function useRifle(id: string | null): Query<StoredRifle | null> {
  return useQuery(() => (id === null ? Promise.resolve(null) : getStore().getRifle(id)), null, [
    id,
  ]);
}

export function useLoads(rifleId?: string): Query<StoredLoad[]> {
  return useQuery(() => getStore().listLoads(rifleId), [], [rifleId]);
}

export function useLoad(id: string | null): Query<StoredLoad | null> {
  return useQuery(() => (id === null ? Promise.resolve(null) : getStore().getLoad(id)), null, [id]);
}

/** A load together with the rifle it belongs to — what DOPE and range mode need. */
export function useProfile(loadId: string | null): Query<{
  load: StoredLoad | null;
  rifle: StoredRifle | null;
}> {
  return useQuery(
    async () => {
      if (loadId === null) return { load: null, rifle: null };
      const load = await getStore().getLoad(loadId);
      if (load === null) return { load: null, rifle: null };
      return { load, rifle: await getStore().getRifle(load.rifleId) };
    },
    { load: null, rifle: null },
    [loadId],
  );
}
