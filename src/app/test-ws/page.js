"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const WS_URL = API_URL.replace(/^http/, "ws");
const WRONG_ID = "00000000-0000-0000-0000-000000000000";

export default function TestWsPage() {
  const socketRef = useRef(null);
  const [log, setLog] = useState([]);

  function addLog(line) {
    setLog((prev) => [...prev, line]);
  }

  async function connect(kind, useWrongId) {
    if (socketRef.current) {
      addLog("Already connected. Disconnect first.");
      return;
    }

    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) {
      addLog("Not logged in. Go to /login first.");
      return;
    }

    const userId = useWrongId ? WRONG_ID : session.user.id;
    const socket = new WebSocket(`${WS_URL}/ws/${kind}/${userId}`);
    socketRef.current = socket;

    socket.onopen = () => {
      addLog(`Socket open (${kind}), sending token...`);
      socket.send(
        JSON.stringify({ type: "auth", token: session.access_token })
      );
    };
    socket.onmessage = (event) => addLog("Received: " + event.data);
    socket.onclose = (event) => {
      addLog(`Closed (code ${event.code})`);
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
    socket.onerror = () => addLog("Socket error");
  }

  function disconnect() {
    if (socketRef.current) {
      socketRef.current.close();
    }
  }

  function sendPing() {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      addLog("Not connected");
      return;
    }
    socket.send(JSON.stringify({ type: "ping" }));
    addLog("Sent: ping");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-2xl font-bold">Test WebSocket channels</h1>

      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={() => connect("rider", false)}
          className="rounded bg-black px-4 py-2 text-white"
        >
          Connect as rider
        </button>
        <button
          onClick={() => connect("driver", false)}
          className="rounded bg-black px-4 py-2 text-white"
        >
          Connect as driver
        </button>
        <button
          onClick={() => connect("rider", true)}
          className="rounded bg-black px-4 py-2 text-white"
        >
          Connect with wrong id
        </button>
        <button
          onClick={disconnect}
          className="rounded bg-black px-4 py-2 text-white"
        >
          Disconnect
        </button>
        <button
          onClick={sendPing}
          className="rounded bg-black px-4 py-2 text-white"
        >
          Send ping
        </button>
      </div>

      <pre className="max-w-xl whitespace-pre-wrap break-words text-sm">
        {log.join("\n")}
      </pre>
    </main>
  );
}