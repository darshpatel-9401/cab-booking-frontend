"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  Spinner,
} from "@/components/ui";
import ReviewForm from "@/components/ReviewForm";
import { authFetch, downloadFile, errorText } from "@/lib/api";
import { formatDistance, formatDuration, formatMoney } from "@/lib/format";

const PAGE_SIZE = 10;
const ACTIVE = ["requested", "accepted", "in_progress"];

const STATUS = {
  completed: { tone: "green", label: "Completed" },
  cancelled: { tone: "neutral", label: "Cancelled" },
  requested: { tone: "indigo", label: "Looking for a driver" },
  accepted: { tone: "indigo", label: "Driver assigned" },
  in_progress: { tone: "indigo", label: "On the trip" },
};

export default function RideHistory({ role }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [currency, setCurrency] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [openReview, setOpenReview] = useState(null);
  const [actionBusy, setActionBusy] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { res, body } = await authFetch(
        `/api/rides/history?role=${role}&limit=${PAGE_SIZE}&offset=0`
      );
      if (cancelled) {
        return;
      }
      if (res && res.ok) {
        setItems(body.rides);
        setTotal(body.total);
        setCurrency(body.currency || "");
        setError("");
      } else {
        setError(errorText(body, "Could not load your rides."));
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [role, reloadKey]);

  function retry() {
    setLoading(true);
    setReloadKey((key) => key + 1);
  }

  function money(amount) {
    return currency ? formatMoney(amount, currency) : String(amount / 100);
  }

  async function loadMore() {
    setLoadingMore(true);
    setNotice(null);

    const { res, body } = await authFetch(
      `/api/rides/history?role=${role}&limit=${PAGE_SIZE}&offset=${items.length}`
    );

    if (res && res.ok) {
      setItems((previous) => {
        const seen = new Set(previous.map((item) => item.ride_id));
        return [...previous, ...body.rides.filter((item) => !seen.has(item.ride_id))];
      });
      setTotal(body.total);
    } else {
      setNotice({
        tone: "error",
        text: errorText(body, "Could not load more rides."),
      });
    }
    setLoadingMore(false);
  }

  function handleReviewDone(rideId, result) {
    setOpenReview(null);
    setNotice({ tone: result.ok ? "success" : "warning", text: result.message });
    setItems((previous) =>
      previous.map((item) =>
        item.ride_id === rideId
          ? { ...item, reviewed: true, can_review: false }
          : item
      )
    );
  }

  async function downloadReceipt(item) {
    setActionBusy(`pdf:${item.ride_id}`);
    setNotice(null);

    const result = await downloadFile(
      `/api/rides/${item.ride_id}/receipt/pdf`,
      `receipt-${item.ride_id.slice(0, 8)}.pdf`
    );
    if (!result.ok) {
      setNotice({ tone: "error", text: result.message });
    }
    setActionBusy("");
  }

  async function emailReceipt(item) {
    setActionBusy(`email:${item.ride_id}`);
    setNotice(null);

    const { res, body } = await authFetch(
      `/api/rides/${item.ride_id}/receipt/email`,
      "POST"
    );

    if (res && res.ok) {
      setNotice({ tone: "success", text: "Your receipt is on its way to your email." });
    } else {
      setNotice({
        tone: res && res.status === 429 ? "warning" : "error",
        text: errorText(body, "Could not send the receipt."),
      });
    }
    setActionBusy("");
  }

  return (
    <section
      aria-label={role === "rider" ? "Your rides" : "Rides you drove"}
      className="flex min-w-0 flex-col gap-4"
    >
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      {loading && (
        <Card className="flex items-center gap-3 p-6 text-sm text-slate-600 dark:text-zinc-400">
          <Spinner className="h-5 w-5" />
          Loading rides...
        </Card>
      )}

      {!loading && error && (
        <div className="flex flex-col items-start gap-3">
          <Alert tone="error" className="w-full">
            {error}
          </Alert>
          <Button variant="secondary" onClick={retry}>
            Try again
          </Button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <Card className="flex flex-col items-start gap-3 p-6">
          <p className="font-medium">No rides yet.</p>
          <ButtonLink href={role === "rider" ? "/book" : "/driver"}>
            {role === "rider" ? "Book your first ride" : "Open the dashboard"}
          </ButtonLink>
        </Card>
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const status = STATUS[item.status] || {
              tone: "neutral",
              label: item.status,
            };
            const fare =
              item.fare_actual != null ? item.fare_actual : item.fare_estimate;
            const paid = item.payment_status === "succeeded";

            return (
              <li key={item.ride_id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                        Ride {item.ride_id.slice(0, 8)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {role === "rider" && item.status === "completed" && (
                        <Badge tone={paid ? "green" : "neutral"}>
                          {paid ? "Paid" : "Payment due"}
                        </Badge>
                      )}
                      {item.reviewed && <Badge tone="indigo">Reviewed</Badge>}
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-zinc-400">
                        Distance
                      </dt>
                      <dd className="font-semibold">
                        {item.distance_meters != null
                          ? formatDistance(item.distance_meters)
                          : "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-zinc-400">
                        Time
                      </dt>
                      <dd className="font-semibold">
                        {item.duration_secs != null
                          ? formatDuration(item.duration_secs)
                          : "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-zinc-400">
                        Fare
                      </dt>
                      <dd className="font-semibold">
                        {fare != null ? money(fare) : "-"}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {ACTIVE.includes(item.status) && (
                      <ButtonLink
                        href={role === "rider" ? "/book" : "/driver"}
                        size="sm"
                      >
                        View ride
                      </ButtonLink>
                    )}

                    {role === "rider" &&
                      item.status === "completed" &&
                      !paid && (
                        <ButtonLink href={`/pay/${item.ride_id}`} size="sm">
                          Pay now
                        </ButtonLink>
                      )}

                    {role === "rider" && paid && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => downloadReceipt(item)}
                          loading={actionBusy === `pdf:${item.ride_id}`}
                          disabled={actionBusy !== ""}
                        >
                          Download receipt
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => emailReceipt(item)}
                          loading={actionBusy === `email:${item.ride_id}`}
                          disabled={actionBusy !== ""}
                        >
                          Email receipt
                        </Button>
                      </>
                    )}

                    {item.can_review && openReview !== item.ride_id && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setOpenReview(item.ride_id)}
                        disabled={actionBusy !== ""}
                      >
                        {role === "rider" ? "Rate your driver" : "Rate your rider"}
                      </Button>
                    )}
                  </div>

                  {openReview === item.ride_id && (
                    <ReviewForm
                      rideId={item.ride_id}
                      target={role === "rider" ? "driver" : "rider"}
                      onDone={(result) => handleReviewDone(item.ride_id, result)}
                      onCancel={() => setOpenReview(null)}
                    />
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && !error && items.length < total && (
        <Button
          variant="secondary"
          onClick={loadMore}
          loading={loadingMore}
          className="self-center"
        >
          Load more
        </Button>
      )}
    </section>
  );
}