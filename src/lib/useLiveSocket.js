"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const WS_URL = API_URL.replace(/^http/, "ws");
const PING_INTERVAL_MS = 25000;
const MAX_RECONNECT_DELAY_MS = 15000;
const POLICY_RECONNECT_DELAY_MS = 10000;

export function useLiveSocket({
  channel,
  userId,
  enabled = true,
  onEvent,
  onConnected,
}) {
  const [status, setStatus] = useState("connecting");
  const handlers = useRef({ onEvent, onConnected });

  // Always call the newest handlers, without reconnecting when they change
  useEffect(() => {
    handlers.current = { onEvent, onConnected };
  });

  const active = Boolean(enabled && userId);

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    let closedByUs = false;
    let socket = null;
    let reconnectTimer = null;
    let pingTimer = null;
    let attempts = 0;

    function stopPing() {
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
    }

    function scheduleReconnect(policyClose) {
      attempts += 1;
      setStatus("reconnecting");
      let delay = Math.min(1000 * 2 ** (attempts - 1), MAX_RECONNECT_DELAY_MS);
      if (policyClose) {
        delay = Math.max(delay, POLICY_RECONNECT_DELAY_MS);
      }
      reconnectTimer = setTimeout(connect, delay);
    }

    async function connect() {
      const { data } = await supabase.auth.getSession();
      if (closedByUs) {
        return;
      }

      const token = data.session ? data.session.access_token : null;
      if (!token) {
        setStatus("offline");
        return;
      }
      if (attempts === 0) {
        setStatus("connecting");
      }

      let ws;
      try {
        ws = new WebSocket(`${WS_URL}/ws/${channel}/${userId}`);
      } catch (err) {
        scheduleReconnect(false);
        return;
      }
      socket = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "auth", token: token }));
      };

      ws.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch (err) {
          return;
        }
        if (!message || typeof message !== "object") {
          return;
        }

        if (message.type === "connected") {
          attempts = 0;
          setStatus("live");
          stopPing();
          pingTimer = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "ping" }));
            }
          }, PING_INTERVAL_MS);
          if (handlers.current.onConnected) {
            handlers.current.onConnected();
          }
          return;
        }

        if (message.type === "pong") {
          return;
        }

        if (handlers.current.onEvent) {
          handlers.current.onEvent(message);
        }
      };

      ws.onclose = (event) => {
        stopPing();
        if (socket === ws) {
          socket = null;
        }
        if (closedByUs) {
          return;
        }
        scheduleReconnect(event.code === 1008);
      };

      ws.onerror = () => {
        // The close event follows and handles the reconnect
      };
    }

    connect();

    return () => {
      closedByUs = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      stopPing();
      if (socket) {
        socket.close();
      }
    };
  }, [active, channel, userId]);

  return active ? status : "offline";
}