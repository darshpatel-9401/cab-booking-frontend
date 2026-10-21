import { supabase } from "@/lib/supabaseClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function authFetch(path, method = "GET", payload = null) {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) {
    return { res: null, body: { detail: "You are not logged in." } };
  }

  const headers = { Authorization: `Bearer ${session.access_token}` };
  const options = { method: method, headers: headers };
  if (payload) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(payload);
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, options);
  } catch (err) {
    return { res: null, body: { detail: "Could not reach the backend." } };
  }

  let body;
  try {
    body = await res.json();
  } catch (err) {
    body = { detail: "The server sent an unexpected response." };
  }
  return { res, body };
}

// Always returns plain text, even if the backend sends a list of validation errors
export function errorText(body, fallback) {
  const detail = body && body.detail;
  return typeof detail === "string" ? detail : fallback;
}

// Downloads a file that needs the login token (for example a PDF receipt)
export async function downloadFile(path, filename) {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) {
    return { ok: false, message: "You are not logged in." };
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  } catch (err) {
    return { ok: false, message: "Could not reach the backend." };
  }

  if (!res.ok) {
    let message = "Could not download the file.";
    try {
      const body = await res.json();
      if (typeof body.detail === "string") {
        message = body.detail;
      }
    } catch (err) {
      // keep the default message
    }
    return { ok: false, message };
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { ok: true, message: "" };
}