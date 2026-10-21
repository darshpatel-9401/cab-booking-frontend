"use client";

import RatingSummary from "@/components/RatingSummary";
import RequireAuth from "@/components/RequireAuth";
import RideHistory from "@/components/RideHistory";

export default function RidesPage() {
  return (
    <RequireAuth title="My rides" loginHref="/login" signupHref="/signup">
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My rides</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          Your trips, receipts and reviews.
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_22rem]">
          <RideHistory role="rider" />
          <RatingSummary />
        </div>
      </main>
    </RequireAuth>
  );
}