"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/components/AuthProvider";
import LiveIndicator from "@/components/LiveIndicator";
import { Alert, Badge, Button, Card, FOCUS, Spinner, cx } from "@/components/ui";
import { authFetch, errorText } from "@/lib/api";
import { formatDistance, formatDuration, formatMoney } from "@/lib/format";
import { useLiveSocket } from "@/lib/useLiveSocket";

const RideMap = dynamic(() => import("@/components/RideMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-zinc-400">
      Loading map...
    </div>
  ),
});

const POLL_MS = 5000;
const SHARE_INTERVAL_MS = 5000;

const RIDE_BADGE = {
  accepted: { tone: "indigo", label: "Head to pickup" },
  in_progress: { tone: "green", label: "On the trip" },
};

function osmLink(point) {
  return `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=17/${point.lat}/${point.lng}`;
}

function formatPoint(point) {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

function PlaceRow({ label, point }) {
  return (
    <div>
      <dt className="text-xs text-slate-500 dark:text-zinc-400">{label}</dt>
      <dd className="flex flex-wrap items-center gap-x-3 text-sm font-medium">
        <span className="break-all">{formatPoint(point)}</span>
        <a
          href={osmLink(point)}
          target="_blank"
          rel="noopener noreferrer"
          className={cx(
            "rounded text-indigo-600 underline underline-offset-4 dark:text-indigo-400",
            FOCUS
          )}
        >
          View on map<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </dd>
    </div>
  );
}

export default function DriverDashboard() {
  const { session } = useAuth();
  const [info, setInfo] = useState(null);
  const [ride, setRide] = useState(null);
  const [history, setHistory] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState("");
  const [draft, setDraft] = useState(null);
  const [focus, setFocus] = useState(null);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [sharing, setSharing] = useState(false);
  const rideIdRef = useRef(null);
  const versionRef = useRef(0);

  const userId = session ? session.user.id : null;
  const currency = info ? info.currency : "";

  function money(amount) {
    return currency ? formatMoney(amount, currency) : String(amount / 100);
  }

  const loadHistory = useCallback(async () => {
    const { res, body } = await authFetch("/api/rides/history?role=driver&limit=5");
    if (res && res.ok) {
      setHistory(body.rides);
    }
  }, []);

  const applyRide = useCallback(
    (newRide) => {
      const newId = newRide ? newRide.ride_id : null;
      const previousId = rideIdRef.current;
      rideIdRef.current = newId;

      setRide(newRide);
      if (!newId) {
        setConfirmComplete(false);
      }
      if (newRide && newId !== previousId) {
        setFocus({
          points: [
            [newRide.pickup.lat, newRide.pickup.lng],
            [newRide.drop.lat, newRide.drop.lng],
          ],
        });
      }
      if (previousId && !newId) {
        loadHistory();
      }
    },
    [loadHistory]
  );

  // Fetches the current ride. A newer fetch, or any start/complete action,
  // makes older answers still on their way be ignored.
  const syncRide = useCallback(async () => {
    versionRef.current += 1;
    const version = versionRef.current;

    const { res, body } = await authFetch("/api/drivers/current-ride");
    if (version !== versionRef.current || !res || !res.ok) {
      return;
    }

    const hadRide = rideIdRef.current !== null;
    applyRide(body.ride);
    if (!hadRide && body.ride) {
      setNotice({ tone: "info", text: "A new ride was assigned to you." });
    } else if (hadRide && !body.ride) {
      setNotice({
        tone: "warning",
        text: "Your ride is no longer active. The rider may have cancelled it.",
      });
    }
  }, [applyRide]);

  const loadAll = useCallback(async () => {
    const [infoResult, rideResult] = await Promise.all([
      authFetch("/api/drivers/me"),
      authFetch("/api/drivers/current-ride"),
    ]);

    if (!infoResult.res || !infoResult.res.ok) {
      setLoadError(errorText(infoResult.body, "Could not load your driver profile."));
      setLoaded(true);
      return;
    }

    setLoadError("");
    setInfo(infoResult.body);

    const currentRide =
      rideResult.res && rideResult.res.ok ? rideResult.body.ride : null;
    if (infoResult.body.location && !currentRide) {
      setFocus({
        points: [[infoResult.body.location.lat, infoResult.body.location.lng]],
      });
    }
    if (rideResult.res && rideResult.res.ok) {
      applyRide(currentRide);
    }

    await loadHistory();
    setLoaded(true);
  }, [applyRide, loadHistory]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function handleLiveEvent(message) {
    if (message.type === "ride_assigned" || message.type === "ride_cancelled") {
      syncRide();
    }
  }

  const liveStatus = useLiveSocket({
    channel: "driver",
    userId,
    enabled: loaded && !loadError && Boolean(userId),
    onEvent: handleLiveEvent,
    onConnected: syncRide,
  });

  // Fallback: while the live connection is down, check for rides every 5 seconds
  useEffect(() => {
    if (!loaded || loadError || liveStatus === "live") {
      return undefined;
    }
    const timer = setInterval(() => {
      if (!document.hidden) {
        syncRide();
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [loaded, loadError, liveStatus, syncRide]);

  // Live location sharing
  useEffect(() => {
    if (!sharing) {
      return undefined;
    }

    let cancelled = false;
    let sending = false;
    let lastSent = 0;
    let failures = 0;
    let first = true;

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const now = Date.now();
        if (cancelled || sending || now - lastSent < SHARE_INTERVAL_MS) {
          return;
        }
        sending = true;
        lastSent = now;

        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        const { res } = await authFetch("/api/drivers/location", "PUT", {
          lat,
          lng,
        });
        sending = false;
        if (cancelled) {
          return;
        }

        if (res && res.ok) {
          failures = 0;
          setInfo((previous) =>
            previous ? { ...previous, location: { lat, lng } } : previous
          );
          if (first) {
            first = false;
            setFocus({ points: [[lat, lng]] });
          }
        } else {
          failures += 1;
          if (failures >= 3) {
            setSharing(false);
            setNotice({
              tone: "warning",
              text: "Location sharing stopped because updates kept failing.",
            });
          }
        }
      },
      (error) => {
        if (cancelled || error.code !== 1) {
          return; // only a refused permission stops sharing
        }
        setSharing(false);
        setNotice({
          tone: "warning",
          text: "Location permission was denied, so sharing was turned off.",
        });
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [sharing]);

  function toggleSharing(event) {
    const wantOn = event.target.checked;
    if (wantOn && !navigator.geolocation) {
      setNotice({
        tone: "warning",
        text: "Your browser can't share your location.",
      });
      return;
    }
    setSharing(wantOn);
    if (wantOn) {
      setDraft(null);
      setNotice(null);
    }
  }

  async function handleRefresh() {
    setBusy("refresh");
    setNotice(null);
    await loadAll();
    setBusy("");
  }

  async function changeStatus(goOnline) {
    setBusy("status");
    setNotice(null);

    const { res, body } = await authFetch("/api/drivers/status", "PUT", {
      status: goOnline ? "active" : "offline",
    });

    if (res && res.ok) {
      setInfo((previous) => ({ ...previous, status: body.status }));
    } else {
      setNotice({
        tone: "error",
        text: errorText(body, "Could not change your status."),
      });
    }
    setBusy("");
  }

  function pickOnMap(lat, lng) {
    setDraft({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
    setNotice(null);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setNotice({
        tone: "warning",
        text: "Your browser can't share your location. Click the map instead.",
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        setDraft({ lat, lng });
        setFocus({ points: [[lat, lng]] });
        setNotice(null);
      },
      () => {
        setNotice({
          tone: "warning",
          text: "Could not get your location. Click the map instead.",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function saveLocation() {
    if (!draft) {
      return;
    }

    setBusy("location");
    setNotice(null);

    const { res, body } = await authFetch("/api/drivers/location", "PUT", {
      lat: draft.lat,
      lng: draft.lng,
    });

    if (res && res.ok) {
      setInfo((previous) => ({
        ...previous,
        location: { lat: body.lat, lng: body.lng },
      }));
      setDraft(null);
      setNotice({ tone: "success", text: "Location saved." });
    } else {
      setNotice({
        tone: "error",
        text: errorText(body, "Could not save your location."),
      });
    }
    setBusy("");
  }

  async function refreshRideAfterError() {
    const again = await authFetch("/api/drivers/current-ride");
    if (again.res && again.res.ok) {
      applyRide(again.body.ride);
    }
  }

  async function startRide() {
    if (!ride) {
      return;
    }

    setBusy("start");
    setNotice(null);
    versionRef.current += 1;

    const { res, body } = await authFetch(`/api/rides/${ride.ride_id}/start`, "POST");
    versionRef.current += 1;

    if (res && res.ok) {
      setRide((previous) =>
        previous ? { ...previous, status: body.status } : previous
      );
      setNotice({ tone: "success", text: "Ride started." });
    } else {
      setNotice({
        tone: "error",
        text: errorText(body, "Could not start the ride."),
      });
      await refreshRideAfterError();
    }
    setBusy("");
  }

  async function completeRide() {
    if (!ride) {
      return;
    }

    setBusy("complete");
    setNotice(null);
    versionRef.current += 1;

    const { res, body } = await authFetch(
      `/api/rides/${ride.ride_id}/complete`,
      "POST"
    );
    versionRef.current += 1;

    if (res && res.ok) {
      applyRide(null);
      setNotice({
        tone: "success",
        text: `Ride completed. Fare: ${money(body.fare_actual)}.`,
      });
    } else {
      setNotice({
        tone: "error",
        text: errorText(body, "Could not complete the ride."),
      });
      await refreshRideAfterError();
    }
    setBusy("");
  }

  if (!loaded) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-10">
        <Card className="flex items-center gap-3 p-6 text-sm text-slate-600 dark:text-zinc-400">
          <Spinner className="h-5 w-5" />
          Loading your dashboard...
        </Card>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <Alert tone="error">{loadError}</Alert>
        <Button
          className="mt-4"
          variant="secondary"
          onClick={handleRefresh}
          loading={busy === "refresh"}
        >
          Try again
        </Button>
      </main>
    );
  }

  const online = info.status === "active";
  const canGoOnline = info.verified && info.location !== null;
  const youPoint = draft || info.location;
  const markers = youPoint
    ? [
        {
          lat: youPoint.lat,
          lng: youPoint.lng,
          label: draft ? "New location" : "You",
          tone: "indigo",
        },
      ]
    : [];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Driver dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            Go online, share your location and run your rides.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LiveIndicator status={liveStatus} />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            loading={busy === "refresh"}
            disabled={busy !== "" && busy !== "refresh"}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[26rem_1fr]">
        <div className="flex min-w-0 flex-col gap-4">
          {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

          <Card className="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={info.verified ? "green" : "neutral"}>
                {info.verified ? "Verified" : "Awaiting verification"}
              </Badge>
              <Badge tone={online ? "indigo" : "neutral"}>
                {online ? "Online" : "Offline"}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Vehicle</p>
              <p className="break-words font-semibold">
                {info.vehicle_info || "-"}
              </p>
            </div>

            <Button
              variant={online ? "secondary" : "primary"}
              size="lg"
              onClick={() => changeStatus(!online)}
              loading={busy === "status"}
              disabled={busy !== "" || (!online && !canGoOnline)}
            >
              {online ? "Go offline" : "Go online"}
            </Button>
            {!online && !info.verified && (
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Your account must be verified before you can go online.
              </p>
            )}
            {!online && info.verified && !info.location && (
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Save your location first.
              </p>
            )}
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <h2 className="text-lg font-semibold">Your location</h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              {draft
                ? `New spot: ${formatPoint(draft)}`
                : info.location
                  ? `Saved: ${formatPoint(info.location)}`
                  : "No location saved yet."}
            </p>

            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-zinc-800">
              <input
                type="checkbox"
                checked={sharing}
                onChange={toggleSharing}
                className="mt-0.5 h-4 w-4 accent-indigo-600"
              />
              <span>
                <span className="font-medium">Share my live location</span>
                <span className="block text-xs text-slate-500 dark:text-zinc-400">
                  Sends your position about every 5 seconds while this page is
                  open. A rider on your trip sees it on their map.
                </span>
              </span>
            </label>

            {!sharing && (
              <>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Or click the map to choose a spot. Riders within 5 km of your
                  saved location can be matched with you.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={useMyLocation}>
                    Use my location
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveLocation}
                    loading={busy === "location"}
                    disabled={!draft || busy !== ""}
                  >
                    Save location
                  </Button>
                  {draft && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDraft(null)}
                      disabled={busy !== ""}
                    >
                      Discard
                    </Button>
                  )}
                </div>
              </>
            )}
          </Card>

          {ride ? (
            <Card className="flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Current ride</h2>
                <Badge
                  tone={RIDE_BADGE[ride.status] ? RIDE_BADGE[ride.status].tone : "neutral"}
                >
                  {RIDE_BADGE[ride.status] ? RIDE_BADGE[ride.status].label : ride.status}
                </Badge>
              </div>

              <div>
                <p className="text-sm text-slate-500 dark:text-zinc-400">Fare</p>
                <p className="text-3xl font-bold tracking-tight">
                  {ride.fare_estimate != null ? money(ride.fare_estimate) : "-"}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500 dark:text-zinc-400">
                    Distance
                  </dt>
                  <dd className="font-semibold">
                    {ride.distance_meters != null
                      ? formatDistance(ride.distance_meters)
                      : "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 dark:text-zinc-400">Time</dt>
                  <dd className="font-semibold">
                    {ride.duration_secs != null
                      ? formatDuration(ride.duration_secs)
                      : "-"}
                  </dd>
                </div>
              </dl>

              <dl className="flex flex-col gap-3">
                <PlaceRow label="Pickup" point={ride.pickup} />
                <PlaceRow label="Drop-off" point={ride.drop} />
              </dl>

              {!sharing && (
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Turn on &quot;Share my live location&quot; so the rider can
                  follow you on their map.
                </p>
              )}

              {ride.status === "accepted" && (
                <Button
                  size="lg"
                  onClick={startRide}
                  loading={busy === "start"}
                  disabled={busy !== ""}
                >
                  Start ride
                </Button>
              )}

              {ride.status === "in_progress" && !confirmComplete && (
                <Button
                  size="lg"
                  onClick={() => setConfirmComplete(true)}
                  disabled={busy !== ""}
                >
                  Complete ride
                </Button>
              )}

              {ride.status === "in_progress" && confirmComplete && (
                <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-zinc-800/60">
                  <p className="text-sm font-medium">
                    Complete this ride? The rider will be asked to pay.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={completeRide}
                      loading={busy === "complete"}
                      disabled={busy !== ""}
                    >
                      Yes, complete ride
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setConfirmComplete(false)}
                      disabled={busy !== ""}
                    >
                      Not yet
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-5">
              <h2 className="text-lg font-semibold">Ride requests</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                {online
                  ? "You are online. New rides appear here by themselves."
                  : "You are offline. Go online to receive rides."}
              </p>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="text-lg font-semibold">Recent rides</h2>
            {history === null && (
              <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
                Loading...
              </p>
            )}
            {history !== null && history.length === 0 && (
              <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
                No rides yet.
              </p>
            )}
            {history !== null && history.length > 0 && (
              <ul className="mt-3 flex flex-col divide-y divide-slate-200 dark:divide-zinc-800">
                {history.map((item) => {
                  const fare =
                    item.fare_actual != null ? item.fare_actual : item.fare_estimate;
                  return (
                    <li
                      key={item.ride_id}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {new Date(item.created_at).toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          {item.distance_meters != null
                            ? formatDistance(item.distance_meters)
                            : "-"}
                          {fare != null ? ` · ${money(fare)}` : ""}
                        </p>
                      </div>
                      <Badge
                        tone={
                          item.status === "completed"
                            ? "green"
                            : item.status === "cancelled"
                              ? "neutral"
                              : "indigo"
                        }
                      >
                        {item.status.replace("_", " ")}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div
          role="region"
          aria-label="Map. Click it to choose your location."
          className="relative isolate order-first h-72 min-w-0 overflow-hidden rounded-2xl border border-slate-200 shadow-sm dark:border-zinc-800 sm:h-96 lg:order-none lg:h-[calc(100vh-11rem)] lg:min-h-[30rem]"
        >
          <RideMap
            pickup={ride ? ride.pickup : null}
            drop={ride ? ride.drop : null}
            markers={markers}
            onPick={sharing ? undefined : pickOnMap}
            target={focus}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-800 shadow dark:bg-zinc-900/90 dark:text-zinc-100"
          >
            {sharing
              ? "Your live location is being shared"
              : "Click the map to choose your location"}
          </div>
        </div>
      </div>
    </main>
  );
}