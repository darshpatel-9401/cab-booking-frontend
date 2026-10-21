"use client";

import { useState } from "react";
import { Alert, Button, cx, inputClasses } from "@/components/ui";
import { StarIcon } from "@/components/Icons";
import { authFetch, errorText } from "@/lib/api";

const MAX_COMMENT = 500;

export default function ReviewForm({ rideId, target, onDone, onCancel }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (rating < 1) {
      setError("Choose a rating from 1 to 5 stars.");
      return;
    }

    setBusy(true);
    const payload = { rating };
    if (comment.trim()) {
      payload.comment = comment;
    }
    const { res, body } = await authFetch(
      `/api/rides/${rideId}/review`,
      "POST",
      payload
    );
    setBusy(false);

    if (res && res.ok) {
      onDone({ ok: true, message: "Thanks! Your review was saved." });
      return;
    }

    const message = errorText(body, "Could not save your review.");
    if (res && res.status === 409 && /already reviewed/i.test(message)) {
      onDone({ ok: false, message });
      return;
    }
    setError(message);
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={`Review your ${target}`}
      className="mt-4 flex flex-col gap-4 rounded-xl bg-slate-50 p-4 dark:bg-zinc-800/60"
    >
      <fieldset>
        <legend className="text-sm font-medium">Your rating</legend>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="relative cursor-pointer">
              <input
                type="radio"
                name={`rating-${rideId}`}
                value={n}
                checked={rating === n}
                onChange={() => setRating(n)}
                className="peer sr-only"
              />
              <span className="block rounded-lg p-1 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-600">
                <StarIcon
                  filled={n <= rating}
                  className={cx(
                    "h-8 w-8",
                    n <= rating
                      ? "text-amber-500"
                      : "text-slate-300 dark:text-zinc-600"
                  )}
                />
                <span className="sr-only">
                  {n} star{n > 1 ? "s" : ""}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`comment-${rideId}`} className="text-sm font-medium">
          Comment (optional)
        </label>
        <textarea
          id={`comment-${rideId}`}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={MAX_COMMENT}
          rows={3}
          className={cx(inputClasses, "border-slate-300 dark:border-zinc-700")}
        />
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          {comment.length}/{MAX_COMMENT}. Only the person you review can read
          this, and they will not see your name.
        </p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={busy}>
          Submit review
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}