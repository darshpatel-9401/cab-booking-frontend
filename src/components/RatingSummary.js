"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Card, Spinner, cx } from "@/components/ui";
import { StarIcon } from "@/components/Icons";
import { authFetch, errorText } from "@/lib/api";

function Stars({ value }) {
  const rounded = Math.round(value);
  return (
    <span
      role="img"
      aria-label={`${value} out of 5 stars`}
      className="inline-flex"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon
          key={n}
          filled={n <= rounded}
          className={cx(
            "h-4 w-4",
            n <= rounded
              ? "text-amber-500"
              : "text-slate-300 dark:text-zinc-600"
          )}
        />
      ))}
    </span>
  );
}

export default function RatingSummary() {
  const { session } = useAuth();
  const userId = session ? session.user.id : null;

  const [summary, setSummary] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      return undefined;
    }

    let cancelled = false;

    async function load() {
      const [summaryResult, reviewsResult] = await Promise.all([
        authFetch(`/api/users/${userId}/rating`),
        authFetch("/api/reviews/received?limit=5"),
      ]);
      if (cancelled) {
        return;
      }

      if (summaryResult.res && summaryResult.res.ok) {
        setSummary(summaryResult.body);
        setError("");
      } else {
        setError(errorText(summaryResult.body, "Could not load your rating."));
      }
      if (reviewsResult.res && reviewsResult.res.ok) {
        setReviews(reviewsResult.body.reviews);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <Card className="flex items-center gap-3 p-5 text-sm text-slate-600 dark:text-zinc-400">
        <Spinner className="h-5 w-5" />
        Loading your rating...
      </Card>
    );
  }

  if (error) {
    return <Alert tone="error">{error}</Alert>;
  }

  return (
    <aside aria-label="Your rating" className="flex min-w-0 flex-col gap-4">
      <Card className="p-5">
        <h2 className="text-lg font-semibold">Your rating</h2>

        {summary.review_count === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
            No ratings yet. They appear here after someone reviews a ride with
            you.
          </p>
        ) : (
          <>
            <div className="mt-2 flex items-end gap-3">
              <p className="text-4xl font-bold tracking-tight">
                {Number(summary.rating_avg).toFixed(1)}
              </p>
              <div className="pb-1">
                <Stars value={Number(summary.rating_avg)} />
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {summary.review_count} rating
                  {summary.review_count === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <ul className="mt-4 flex flex-col gap-1.5">
              {[5, 4, 3, 2, 1].map((n) => {
                const count = summary.distribution[String(n)] || 0;
                const percent = Math.round((count / summary.review_count) * 100);
                return (
                  <li key={n} className="flex items-center gap-2 text-xs">
                    <span className="w-14 shrink-0">
                      {n} star{n > 1 ? "s" : ""}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700">
                      <span
                        className="block h-full rounded-full bg-amber-500"
                        style={{ width: `${percent}%` }}
                      />
                    </span>
                    <span className="w-6 text-right tabular-nums">{count}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      {reviews.length > 0 && (
        <Card className="p-5">
          <h2 className="text-lg font-semibold">Latest reviews about you</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Only you can see these comments. Reviewers stay anonymous.
          </p>
          <ul className="mt-3 flex flex-col divide-y divide-slate-200 dark:divide-zinc-800">
            {reviews.map((review) => (
              <li key={review.review_id} className="py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <Stars value={review.rating} />
                  <span className="text-xs text-slate-500 dark:text-zinc-400">
                    From a {review.from_role} ·{" "}
                    {new Date(review.created_at).toLocaleDateString()}
                  </span>
                </div>
                {review.comment && (
                  <p className="mt-1.5 whitespace-pre-wrap break-words">
                    {review.comment}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </aside>
  );
}