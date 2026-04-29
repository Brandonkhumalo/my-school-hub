import React, { useEffect, useState, useCallback } from "react";
import { pendingSyncCount, getSyncQueue, removeFromSyncQueue } from "../utils/offlineDB.js";

export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(0);

  const refreshQueueCount = useCallback(async () => {
    const count = await pendingSyncCount();
    setQueueCount(count);
  }, []);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      refreshQueueCount();
      // Tell the SW to drain the queue
      navigator.serviceWorker?.controller?.postMessage({ type: "DRAIN_SYNC_QUEUE" });
      // Also register a Background Sync if the browser supports it
      navigator.serviceWorker?.ready.then((reg) => {
        if ("sync" in reg) reg.sync.register("sync-queue").catch(() => {});
      });
    };
    const goOffline = () => {
      setOnline(false);
      refreshQueueCount();
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    // Listen for sync-complete messages from the SW
    const handleSwMessage = (event) => {
      if (event.data?.type === "SYNC_COMPLETE") {
        setJustSynced(event.data.count || 0);
        refreshQueueCount();
        setTimeout(() => setJustSynced(0), 4000);
      }
    };
    navigator.serviceWorker?.addEventListener("message", handleSwMessage);

    refreshQueueCount();

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      navigator.serviceWorker?.removeEventListener("message", handleSwMessage);
    };
  }, [refreshQueueCount]);

  // Poll queue count every 10s to stay in sync
  useEffect(() => {
    const id = setInterval(refreshQueueCount, 10_000);
    return () => clearInterval(id);
  }, [refreshQueueCount]);

  const handleSyncNow = async () => {
    setSyncing(true);
    navigator.serviceWorker?.controller?.postMessage({ type: "DRAIN_SYNC_QUEUE" });
    navigator.serviceWorker?.ready.then((reg) => {
      if ("sync" in reg) reg.sync.register("sync-queue").catch(() => {});
    });
    // Give SW a moment then refresh the count
    setTimeout(async () => {
      await refreshQueueCount();
      setSyncing(false);
    }, 3000);
  };

  // Show "just synced" toast briefly when coming back online
  if (justSynced > 0 && online) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: "#166534",
          color: "#dcfce7",
          padding: "0.5rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          fontSize: "0.85rem",
          fontFamily: "inherit",
        }}
      >
        <span>✓</span>
        <span>
          {justSynced} {justSynced === 1 ? "change" : "changes"} synced successfully
        </span>
      </div>
    );
  }

  if (online && queueCount === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: online ? "#78350f" : "#1c1917",
        color: online ? "#fef3c7" : "#d6d3d1",
        padding: "0.5rem 1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        fontSize: "0.85rem",
        fontFamily: "inherit",
        flexWrap: "wrap",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: online ? "#f59e0b" : "#ef4444",
            flexShrink: 0,
          }}
        />
        {online
          ? `Back online — ${queueCount} ${queueCount === 1 ? "change" : "changes"} pending sync`
          : "You're offline — showing cached data"}
      </span>

      {queueCount > 0 && !online && (
        <span style={{ color: "#a8a29e" }}>
          {queueCount} {queueCount === 1 ? "change" : "changes"} will sync when reconnected
        </span>
      )}

      {online && queueCount > 0 && (
        <button
          onClick={handleSyncNow}
          disabled={syncing}
          style={{
            padding: "0.2rem 0.75rem",
            borderRadius: 6,
            border: "1px solid #f59e0b",
            background: "transparent",
            color: "#fef3c7",
            cursor: syncing ? "not-allowed" : "pointer",
            fontSize: "0.8rem",
            opacity: syncing ? 0.6 : 1,
          }}
        >
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      )}
    </div>
  );
}
