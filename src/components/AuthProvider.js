"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabaseClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const AuthContext = createContext({
  session: null,
  profile: null,
  profileError: "",
  loading: true,
  reloadProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

async function fetchProfile(accessToken) {
  try {
    const res = await fetch(`${API_URL}/api/auth/session`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await res.json();
    if (!res.ok) {
      const detail = typeof body.detail === "string" ? body.detail : "";
      return { profile: null, error: detail || "Could not load your profile." };
    }
    return { profile: body, error: "" };
  } catch (err) {
    return { profile: null, error: "Could not reach the backend." };
  }
}

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [loading, setLoading] = useState(true);
  const loadedFor = useRef(null);

  useEffect(() => {
    let active = true;

    function applySession(newSession) {
      if (!active) {
        return;
      }
      setSession(newSession);
      setLoading(false);

      if (!newSession) {
        loadedFor.current = null;
        setProfile(null);
        setProfileError("");
        return;
      }

      const userId = newSession.user.id;
      if (loadedFor.current === userId) {
        return;
      }
      loadedFor.current = userId;

      fetchProfile(newSession.access_token).then((result) => {
        if (!active || loadedFor.current !== userId) {
          return;
        }
        setProfile(result.profile);
        setProfileError(result.error);
        if (result.error) {
          loadedFor.current = null; // allow a retry on the next auth event
        }
      });
    }

    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      applySession(newSession);
    });

    supabase.auth.getSession().then(({ data: sessionData }) => {
      applySession(sessionData.session);
    });

    return () => {
      active = false;
      loadedFor.current = null;
      data.subscription.unsubscribe();
    };
  }, []);

  const reloadProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      return;
    }
    const result = await fetchProfile(data.session.access_token);
    if (result.profile) {
      setProfile(result.profile);
      setProfileError("");
    } else {
      setProfileError(result.error);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, profile, profileError, loading, reloadProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}