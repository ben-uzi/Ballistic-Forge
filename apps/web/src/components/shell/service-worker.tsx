'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker in production only. In development it actively
 * unregisters, because a cached shell against a hot-reloading dev server
 * produces confusing stale pages.
 */
export function ServiceWorkerRegistrar(): null {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) void registration.unregister();
      });
      return;
    }

    const register = (): void => {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Offline support is a bonus; a failed registration must not surface to the user.
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
