"use client";

import { useEffect } from "react";

/**
 * Keeps the screen from dimming/locking while `active` is true, using the
 * Screen Wake Lock API (Chrome/Edge, Safari 16.4+, Firefox 126+). The browser
 * drops the lock whenever the page is hidden, so it's re-requested when the
 * page becomes visible again. Silently does nothing where unsupported.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    async function acquire() {
      if (released || document.visibilityState !== "visible") return;
      try {
        sentinel = await navigator.wakeLock.request("screen");
        if (released) void sentinel.release();
      } catch {
        // Denied (low battery, not visible, permissions policy) — screen just may sleep
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") void acquire();
    }

    void acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
