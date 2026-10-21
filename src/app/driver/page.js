"use client";

import { useState } from "react";
import DriverDashboard from "@/components/DriverDashboard";
import { useAuth } from "@/components/AuthProvider";
import { authFetch, errorText } from "@/lib/api";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  Input,
  Spinner,
} from "@/components/ui";

function Shell({ children }) {
  return <main className="mx-auto w-full max-w-3xl px-4 py-10">{children}</main>;
}

function Loading({ text }) {
  return (
    <Card className="flex items-center gap-3 p-6 text-sm text-slate-600 dark:text-zinc-400">
      <Spinner className="h-5 w-5" />
      {text}
    </Card>
  );
}

export default function DriverPage() {
  const { session, profile, profileError, loading, reloadProfile } = useAuth();
  const [vehicle, setVehicle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleRegister(e) {
    e.preventDefault();
    setError("");

    const value = vehicle.trim();
    if (value.length < 2) {
      setError("Describe your vehicle, for example: White Toyota Etios, ABC 1234.");
      return;
    }

    setBusy(true);
    const { res, body } = await authFetch("/api/drivers/register", "POST", {
      vehicle_info: value,
    });

    if (res && (res.ok || res.status === 409)) {
      // 409 means this account is already a driver, so we just reload the profile
      await reloadProfile();
    } else {
      setError(errorText(body, "Could not register. Please try again."));
    }
    setBusy(false);
  }

  if (loading) {
    return (
      <Shell>
        <Loading text="Loading..." />
      </Shell>
    );
  }

  if (!session) {
    return (
      <Shell>
        <Card className="flex flex-col gap-4 p-8">
          <h1 className="text-2xl font-bold tracking-tight">Drive with us</h1>
          <p className="text-slate-600 dark:text-zinc-400">
            Log in or create a driver account to register your vehicle and take
            ride requests.
          </p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/driver/login">Driver login</ButtonLink>
            <ButtonLink href="/driver/signup" variant="secondary">
              Sign up as a driver
            </ButtonLink>
          </div>
        </Card>
      </Shell>
    );
  }

  if (!profile) {
    return (
      <Shell>
        {profileError ? (
          <Alert tone="error">{profileError}</Alert>
        ) : (
          <Loading text="Setting up your account..." />
        )}
      </Shell>
    );
  }

  if (profile.role !== "driver") {
    return (
      <Shell>
        <Card className="p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight">Become a driver</h1>
          <p className="mt-1 text-slate-600 dark:text-zinc-400">
            Tell us about your vehicle to create your driver profile.
          </p>

          <form onSubmit={handleRegister} className="mt-6 flex flex-col gap-4">
            <Input
              id="vehicle"
              label="Your vehicle"
              hint="Make, model, colour and number plate."
              placeholder="White Toyota Etios, ABC 1234"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              maxLength={200}
              autoComplete="off"
              required
            />
            {error && <Alert tone="error">{error}</Alert>}
            <Alert tone="info">
              New driver accounts must be verified before they can go online.
            </Alert>
            <Button type="submit" size="lg" loading={busy}>
              {busy ? "Registering..." : "Register as a driver"}
            </Button>
          </form>
        </Card>
      </Shell>
    );
  }

  return <DriverDashboard />;
}