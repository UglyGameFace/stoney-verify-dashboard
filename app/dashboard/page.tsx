"use client";

import { useEffect, useState } from "react";
import { getSession } from "@/lib/session";

export default function Dashboard() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    async function loadSession() {
      const res = await fetch("/api/session");
      if (res.ok) setSession(await res.json());
    }
    loadSession();
  }, []);

  return (
    <div style={{ padding: "32px", fontFamily: "Arial, sans-serif" }}>
      <h1>Stoney Verify Dashboard</h1>
      {session ? (
        <>
          <p>Welcome, {session.username}!</p>
          <div style={{ marginTop: "24px" }}>
            <h2>📊 Panels</h2>
            <ul>
              <li>🔍 Token Viewer</li>
              <li>📝 Audit Logs</li>
              <li>📡 Real-Time Monitor</li>
              <li>🕒 Kick Timers</li>
            </ul>
          </div>
        </>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
}
