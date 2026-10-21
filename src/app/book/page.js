"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/components/AuthProvider";
import LiveIndicator from "@/components/LiveIndicator";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  Input,
  Spinner,
  cx,
} from "@/components/ui";
import { CheckIcon } from "@/components/Icons";
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

const ACTIVE_STATUSES = ["requested", "accepted", "in_progress"];
const EMPTY_POINT = { lat: "", lng: "" };

const STATUS_BADGE = {
  requested: { tone: "neutral", label: "Looking for a driver" },
  accepted: { tone: "indigo", label: "Driver assigned" },
  in_progress: { tone: "green", label: "On the trip" },
};
const TRIP_STEPS = ["Looking for a driver", "Driver assigned", "On the trip"];
const TRIP_INDEX = { requested: 0, accepted: 1, in_progress: 2 };
const FLOW_STEPS = ["Route", "Fare", "Driver", "Trip"];

function parsePoint(point) {
  if (point.lat.trim() === "" || point.lng.trim() === "") {
    return null;
  }
  const lat = Number(point.lat);
  const lng = Number(point.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { lat, lng };
}

function Stepper({ current }) {
  return (
    <ol className="flex items-start gap-2" aria-label="Booking progress">
      {FLOW_STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className="flex flex-1 flex-col gap-1.5"
          >
            <span
              className={cx(
                "h-1.5 rounded-full",
                done || active
                  ? "bg-indigo-600"
                  : "bg-slate-200 dark:bg-zinc-700"
              )}
            />
            <span
              className={cx(
                "text-xs font-medium",
                active
                  ? "text-indigo-700 dark:text-indigo-300"
                  : "text-slate-500 dark:text-zinc-400"
              )}
            >
              {label}
              {done && <span className="sr-only"> (done)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function TripTimeline({ status }) {
  const current = TRIP_INDEX[status] ?? 0;
  return (
    <ol className="flex flex-col gap-3">
      {TRIP_STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className="flex items-center gap-3 text-sm"
          >
            <span
              className={cx(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                done
                  ? "bg-indigo-600 text-white"
                  : active
                    ? "border-2 border-indigo-600 text-indigo-700 dark:text-indigo-300"
                    : "border-2 border-slate-300 text-slate-400 dark:border-zinc-600 dark:text-zinc-500"
              )}
            >
              {done ? <CheckIcon className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span
              className={cx(
                active
                  ? "font-semibold"
                  : "text-slate-600 dark:text-zinc-400"
              )}
            >
              {label}
              {done && <span className="sr-only"> (done)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function PointOption({ value, selecting, onSelect, label, point, accent }) {
  return (
    <label className="relative flex-1 cursor-pointer">
      <input
        type="radio"
        name="selecting"
        className="peer sr-only"
        checked={selecting === value}
        onChange={() => onSelect(value)}
      />
      <span
        className={cx(
          "block rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:bg-slate-50",
          "dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800",
          "peer-checked:border-indigo-600 peer-checked:ring-2 peer-checked:ring-indigo-600/20",
          "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-600"
        )}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className={cx("h-2.5 w-2.5 rounded-full", accent)} />
          {label}
        </span>
        <span className="mt-1 block break-all text-xs text-slate-500 dark:text-zinc-400">
          {point
            ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
            : "Click the map"}
        </span>
      </span>
    </label>
  );
}

function PointFields({ id, label, value, onChange }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold">{label}</legend>
      <div className="grid grid-cols-2 gap-3">
        <Input
          id={`${id}-lat`}
          label="Latitude"
          value={value.lat}
          onChange={(e) => onChange("lat", e.target.value)}
          inputMode="decimal"
        />
        <Input
          id={`${id}-lng`}
          label="Longitude"
          value={value.lng}
          onChange={(e) => onChange("lng", e.target.value)}
          inputMode="decimal"
        />
      </div>
    </fieldset>
  );
}

export default function BookPage() {
  const { session, profile, profileError, loading } = useAuth();

  const [pickup, setPickup] = useState(EMPTY_POINT);
  const [drop, setDrop] = useState(EMPTY_POINT);
  const [selecting, setSelecting] = useState("pickup");
  const [estimate, setEstimate] = useState(null);
  const [ride, setRide] = useState(null);
  const [driver, setDriver] = useState(null);
  const [driverPos, setDriverPos] = useState(null);
  const [lastRide, setLastRide] = useState(null);
  const [currency, setCurrency] = useState("");
  const [rideLoaded, setRideLoaded] = useState(false);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState("");
  const [focus, setFocus] = useState(null);

  const pickupPoint = parsePoint(pickup);
  const dropPoint = parsePoint(drop);
  const rideActive = ride !== null;
  const rideId = ride ? ride.ride_id : null;
  const userId = session ? session.user.id : null;

  let flowStep = 0;
  if (rideActive) {
    flowStep = ride.status === "requested" ? 2 : 3;
  } else if (estimate) {
    flowStep = 1;
  }

  function money(amount, cur) {
    return cur ? formatMoney(amount, cur) : String(amount / 100);
  }

  const refreshRide = useCallback(async () => {
    const { res, body } = await authFetch("/api/rides/history?role=rider&limit=1");
    if (!res || !res.ok) {
      return errorText(body, "Could not load your ride.");
    }

    setCurrency(body.currency || "");
    const latest = body.rides[0];

    if (latest && ACTIVE_STATUSES.includes(latest.status)) {
      setRide({ ride_id: latest.ride_id, status: latest.status });
      setLastRide(null);

      if (latest.status === "requested") {
        setDriver(null);
        setDriverPos(null);
      } else {
        const status = await authFetch(`/api/rides/${latest.ride_id}/status`);
        if (status.res && status.res.ok) {
          setDriver((previous) => ({
            vehicle_info: status.body.vehicle_info,
            distance_meters: previous ? previous.distance_meters : null,
          }));
        }
      }
    } else {
      setRide(null);
      setDriver(null);
      setDriverPos(null);
      setLastRide(latest && latest.status === "completed" ? latest : null);
    }
    return "";
  }, []);

  useEffect(() => {
    if (!profile) {
      return;
    }
    refreshRide().then((error) => {
      if (error) {
        setNotice({ tone: "error", text: error });
      }
      setRideLoaded(true);
    });
  }, [profile, refreshRide]);

  function handleLiveEvent(message) {
    const data = message && message.data ? message.data : {};

    if (message.type === "driver_location") {
      if (
        data.ride_id === rideId &&
        Number.isFinite(data.lat) &&
        Number.isFinite(data.lng)
      ) {
        setDriverPos({ lat: data.lat, lng: data.lng });
      }
      return;
    }

    if (message.type === "ride_status") {
      if (!data.ride_id) {
        refreshRide();
        return;
      }
      if (data.status === "accepted") {
        if (data.driver) {
          setDriver(data.driver);
        }
        setRide({ ride_id: data.ride_id, status: "accepted" });
        setNotice({ tone: "success", text: "A driver has accepted your ride." });
      } else if (data.status === "in_progress") {
        setRide({ ride_id: data.ride_id, status: "in_progress" });
        setNotice({ tone: "info", text: "Your trip has started." });
      } else if (data.status === "completed") {
        setNotice({
          tone: "success",
          text: "Your trip is complete. You can pay now.",
        });
        refreshRide();
      } else {
        refreshRide();
      }
      return;
    }

    if (message.type === "payment_status") {
      if (data.status === "succeeded") {
        setNotice({ tone: "success", text: "Payment received. Thank you!" });
      } else if (data.status === "failed") {
        setNotice({ tone: "warning", text: "A payment attempt failed." });
      }
      refreshRide();
    }
  }

  const liveStatus = useLiveSocket({
    channel: "rider",
    userId,
    enabled: Boolean(profile && userId),
    onEvent: handleLiveEvent,
    onConnected: refreshRide,
  });

  // Fallback: while the live connection is down, check the ride every 10 seconds
  useEffect(() => {
    if (!rideId || liveStatus === "live") {
      return undefined;
    }
    const timer = setInterval(() => {
      if (!document.hidden) {
        refreshRide();
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [rideId, liveStatus, refreshRide]);

  function updatePoint(which, field, value) {
    const setter = which === "pickup" ? setPickup : setDrop;
    setter((previous) => ({ ...previous, [field]: value }));
    setEstimate(null);
  }

  function setPointFromMap(lat, lng) {
    const value = { lat: lat.toFixed(6), lng: lng.toFixed(6) };
    if (selecting === "pickup") {
      setPickup(value);
      if (!dropPoint) {
        setSelecting("drop");
      }
    } else {
      setDrop(value);
    }
    setEstimate(null);
    setNotice(null);
  }

  function fillFromMyLocation() {
    if (!navigator.geolocation) {
      setNotice({
        tone: "warning",
        text: "Your browser can't share your location. Click the map instead.",
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setPickup({ lat: lat.toFixed(6), lng: lng.toFixed(6) });
        setSelecting("drop");
        setEstimate(null);
        setFocus({ points: [[lat, lng]] });
        setNotice(null);
      },
      () => {
        setNotice({
          tone: "warning",
          text: "Could not get your location. Click the map or type coordinates instead.",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function fillExample() {
    setPickup({ lat: "51.508", lng: "-0.1281" });
    setDrop({ lat: "51.5055", lng: "-0.0754" });
    setSelecting("pickup");
    setEstimate(null);
    setNotice(null);
    setFocus({
      points: [
        [51.508, -0.1281],
        [51.5055, -0.0754],
      ],
    });
  }

  async function getEstimate() {
    if (!pickupPoint || !dropPoint) {
      setNotice({ tone: "warning", text: "Choose both points first." });
      return;
    }

    setBusy("estimate");
    setNotice(null);

    const query = new URLSearchParams({
      origin_lat: pickupPoint.lat,
      origin_lng: pickupPoint.lng,
      dest_lat: dropPoint.lat,
      dest_lng: dropPoint.lng,
    });
    const { res, body } = await authFetch(`/api/rides/estimate?${query}`);

    if (res && res.ok) {
      setEstimate(body);
      setCurrency(body.currency || currency);
      setFocus({
        points: [
          [pickupPoint.lat, pickupPoint.lng],
          [dropPoint.lat, dropPoint.lng],
        ],
      });
    } else {
      setNotice({
        tone: "error",
        text: errorText(body, "Could not get an estimate. Check the points."),
      });
    }
    setBusy("");
  }

  async function requestRide() {
    if (!pickupPoint || !dropPoint) {
      return;
    }

    setBusy("request");
    setNotice(null);

    const { res, body } = await authFetch("/api/rides/request", "POST", {
      pickup_lat: pickupPoint.lat,
      pickup_lng: pickupPoint.lng,
      drop_lat: dropPoint.lat,
      drop_lng: dropPoint.lng,
    });

    if (res && res.ok) {
      setRide({ ride_id: body.ride_id, status: body.status });
      setDriver(null);
      setDriverPos(null);
      setLastRide(null);
      setEstimate(null);
      setCurrency(body.currency || currency);
      setNotice({ tone: "success", text: "Ride requested. Now find a driver." });
    } else {
      setNotice({
        tone: "error",
        text: errorText(body, "Could not request the ride. Check the points."),
      });
      if (res && res.status === 409) {
        await refreshRide();
      }
    }
    setBusy("");
  }

  async function findDriver() {
    if (!rideId) {
      return;
    }

    setBusy("match");
    setNotice(null);

    const { res, body } = await authFetch(`/api/rides/${rideId}/match`, "POST");

    if (res && res.ok) {
      setRide({ ride_id: rideId, status: body.status });
      setDriver(body.driver);
      setNotice({ tone: "success", text: "A driver has accepted your ride." });
    } else {
      setNotice({
        tone: "error",
        text: errorText(body, "Could not find a driver."),
      });
      if (res && res.status === 409) {
        await refreshRide();
      }
    }
    setBusy("");
  }

  async function cancelRide() {
    if (!rideId) {
      return;
    }

    setBusy("cancel");
    setNotice(null);

    const { res, body } = await authFetch(`/api/rides/${rideId}/cancel`, "POST");

    if (res && res.ok) {
      setRide(null);
      setDriver(null);
      setDriverPos(null);
      setNotice({ tone: "success", text: "Ride cancelled." });
    } else {
      setNotice({
        tone: "error",
        text: errorText(body, "Could not cancel the ride."),
      });
      await refreshRide();
    }
    setBusy("");
  }

  async function handleRefresh() {
    setBusy("refresh");
    const error = await refreshRide();
    setNotice(error ? { tone: "error", text: error } : null);
    setBusy("");
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-10">
        <Card className="flex items-center gap-3 p-6 text-sm text-slate-600 dark:text-zinc-400">
          <Spinner className="h-5 w-5" />
          Loading...
        </Card>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <Card className="flex flex-col gap-4 p-8">
          <h1 className="text-2xl font-bold tracking-tight">Book a ride</h1>
          <p className="text-slate-600 dark:text-zinc-400">
            Log in to book a ride.
          </p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/login">Log in</ButtonLink>
            <ButtonLink href="/signup" variant="secondary">
              Sign up
            </ButtonLink>
          </div>
        </Card>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        {profileError ? (
          <Alert tone="error">{profileError}</Alert>
        ) : (
          <Card className="flex items-center gap-3 p-6 text-sm text-slate-600 dark:text-zinc-400">
            <Spinner className="h-5 w-5" />
            Setting up your account...
          </Card>
        )}
      </main>
    );
  }

  const lastRideFare = lastRide
    ? (lastRide.fare_actual ?? lastRide.fare_estimate)
    : null;

  const markers =
    rideActive && driverPos
      ? [
          {
            lat: driverPos.lat,
            lng: driverPos.lng,
            label: "Driver",
            tone: "indigo",
          },
        ]
      : [];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {rideActive ? "Your ride" : "Where to?"}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            {rideActive
              ? "This page updates by itself."
              : "Pick your pickup and drop-off on the map."}
          </p>
        </div>
        <LiveIndicator status={liveStatus} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[26rem_1fr]">
        <div className="flex min-w-0 flex-col gap-4">
          <Stepper current={flowStep} />

          {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

          {!rideLoaded && (
            <Card className="flex items-center gap-3 p-5 text-sm text-slate-600 dark:text-zinc-400">
              <Spinner className="h-5 w-5" />
              Checking for an active ride...
            </Card>
          )}

          {rideLoaded && rideActive && (
            <Card className="flex flex-col gap-5 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Trip status</h2>
                <Badge
                  tone={
                    STATUS_BADGE[ride.status]
                      ? STATUS_BADGE[ride.status].tone
                      : "neutral"
                  }
                >
                  {STATUS_BADGE[ride.status]
                    ? STATUS_BADGE[ride.status].label
                    : ride.status}
                </Badge>
              </div>

              <TripTimeline status={ride.status} />

              {driver && (
                <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-zinc-800/60">
                  <p className="font-semibold">Your driver</p>
                  <dl className="mt-2 flex flex-col gap-2">
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-zinc-400">
                        Vehicle
                      </dt>
                      <dd className="break-words font-medium">
                        {driver.vehicle_info || "-"}
                      </dd>
                    </div>
                    {driver.distance_meters != null && (
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-zinc-400">
                          Distance from your pickup
                        </dt>
                        <dd className="font-medium">
                          {formatDistance(driver.distance_meters)}
                        </dd>
                      </div>
                    )}
                  </dl>
                  {ride.status !== "requested" && (
                    <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400">
                      {driverPos
                        ? "Your driver's live position is shown on the map."
                        : "Your driver's live position will appear on the map when they share it."}
                    </p>
                  )}
                </div>
              )}

              {ride.status === "in_progress" && (
                <p className="text-sm text-slate-600 dark:text-zinc-400">
                  The trip is in progress. This page will tell you when it ends.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {ride.status === "requested" && (
                  <Button
                    onClick={findDriver}
                    loading={busy === "match"}
                    disabled={busy !== ""}
                  >
                    Find a driver
                  </Button>
                )}
                {(ride.status === "requested" || ride.status === "accepted") && (
                  <Button
                    variant="secondary"
                    onClick={cancelRide}
                    loading={busy === "cancel"}
                    disabled={busy !== ""}
                  >
                    Cancel ride
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={handleRefresh}
                  loading={busy === "refresh"}
                  disabled={busy !== ""}
                >
                  Refresh status
                </Button>
              </div>
            </Card>
          )}

          {rideLoaded && !rideActive && (
            <>
              <Card className="flex flex-col gap-4 p-5">
                <fieldset>
                  <legend className="sr-only">
                    Choose which point a map click sets
                  </legend>
                  <div className="flex gap-3">
                    <PointOption
                      value="pickup"
                      selecting={selecting}
                      onSelect={setSelecting}
                      label="Pickup"
                      point={pickupPoint}
                      accent="bg-green-500"
                    />
                    <PointOption
                      value="drop"
                      selecting={selecting}
                      onSelect={setSelecting}
                      label="Drop-off"
                      point={dropPoint}
                      accent="bg-rose-500"
                    />
                  </div>
                </fieldset>

                <details className="rounded-xl border border-slate-200 dark:border-zinc-800">
                  <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
                    Type coordinates instead
                  </summary>
                  <div className="flex flex-col gap-4 border-t border-slate-200 p-4 dark:border-zinc-800">
                    <PointFields
                      id="pickup"
                      label="Pickup"
                      value={pickup}
                      onChange={(field, value) =>
                        updatePoint("pickup", field, value)
                      }
                    />
                    <PointFields
                      id="drop"
                      label="Drop-off"
                      value={drop}
                      onChange={(field, value) => updatePoint("drop", field, value)}
                    />
                  </div>
                </details>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={fillFromMyLocation}
                  >
                    Use my location
                  </Button>
                  <Button variant="secondary" size="sm" onClick={fillExample}>
                    Try example points
                  </Button>
                </div>

                <Button
                  size="lg"
                  onClick={getEstimate}
                  disabled={!pickupPoint || !dropPoint}
                  loading={busy === "estimate"}
                >
                  Get fare estimate
                </Button>
                {(!pickupPoint || !dropPoint) && (
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Set both points to continue.
                  </p>
                )}
              </Card>

              {estimate && (
                <Card className="p-5">
                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    Estimated fare
                  </p>
                  <p className="mt-1 text-4xl font-bold tracking-tight">
                    {money(estimate.fare_estimate, estimate.currency)}
                  </p>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-zinc-400">
                        Distance
                      </dt>
                      <dd className="font-semibold">
                        {formatDistance(estimate.distance_meters)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-zinc-400">
                        Time
                      </dt>
                      <dd className="font-semibold">
                        {formatDuration(estimate.duration_secs)}
                      </dd>
                    </div>
                  </dl>
                  <Button
                    size="lg"
                    className="mt-5 w-full"
                    onClick={requestRide}
                    loading={busy === "request"}
                    disabled={busy !== ""}
                  >
                    Request ride
                  </Button>
                  <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                    You pay after the ride is completed.
                  </p>
                </Card>
              )}

              {lastRide && (
                <Card className="flex flex-col gap-3 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">Your last ride</h2>
                    {lastRide.payment_status === "succeeded" ? (
                      <Badge tone="green">Paid</Badge>
                    ) : (
                      <Badge tone="neutral">Payment due</Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-zinc-400">
                    {new Date(lastRide.created_at).toLocaleString()}
                  </p>
                  <dl className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-zinc-400">
                        Distance
                      </dt>
                      <dd className="font-semibold">
                        {lastRide.distance_meters != null
                          ? formatDistance(lastRide.distance_meters)
                          : "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-zinc-400">
                        Time
                      </dt>
                      <dd className="font-semibold">
                        {lastRide.duration_secs != null
                          ? formatDuration(lastRide.duration_secs)
                          : "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-zinc-400">
                        Fare
                      </dt>
                      <dd className="font-semibold">
                        {lastRideFare != null ? money(lastRideFare, currency) : "-"}
                      </dd>
                    </div>
                  </dl>
                  {lastRide.payment_status !== "succeeded" && (
                    <ButtonLink href={`/pay/${lastRide.ride_id}`} size="lg">
                      Pay now
                    </ButtonLink>
                  )}
                </Card>
              )}
            </>
          )}
        </div>

        <div
          role="region"
          aria-label="Map. Click it to set the selected point, or type coordinates in the form."
          className="relative isolate order-first h-72 min-w-0 overflow-hidden rounded-2xl border border-slate-200 shadow-sm dark:border-zinc-800 sm:h-96 lg:order-none lg:h-[calc(100vh-11rem)] lg:min-h-[30rem]"
        >
          <RideMap
            pickup={pickupPoint}
            drop={dropPoint}
            markers={markers}
            onPick={rideActive ? undefined : setPointFromMap}
            target={focus}
          />
          {rideLoaded && !rideActive && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-800 shadow dark:bg-zinc-900/90 dark:text-zinc-100"
            >
              Click the map to set the{" "}
              {selecting === "pickup" ? "pickup" : "drop-off"}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}