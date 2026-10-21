"use client";

import { useAuth } from "@/components/AuthProvider";
import RatingSummary from "@/components/RatingSummary";
import RequireAuth from "@/components/RequireAuth";
import RideHistory from "@/components/RideHistory";
import { ButtonLink, Card } from "@/components/ui";

function DriverRidesContent() {
  const { profile } = useAuth();

  if (profile.role !== "driver") {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <Card className="flex flex-col items-start gap-4 p-8">
          <h1 className="text-2xl font-bold tracking-tight">Ride history</h1>
          <p className="text-slate-600 dark:text-zinc-400">
            You need a driver profile to see rides you drove.
          </p>
          <ButtonLink href="/driver">Become a driver</ButtonLink>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        Ride history
      </h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
        Rides you drove, and reviews about you.
      </p>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_22rem]">
        <RideHistory role="driver" />
        <RatingSummary />
      </div>
    </main>
  );
}

export default function DriverRidesPage() {
  return (
    <RequireAuth
      title="Ride history"
      loginHref="/driver/login"
      signupHref="/driver/signup"
    >
      <DriverRidesContent />
    </RequireAuth>
  );
}