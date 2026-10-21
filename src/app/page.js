"use client";

import { useAuth } from "@/components/AuthProvider";
import { Alert, ButtonLink, Card, Spinner } from "@/components/ui";
import {
  CarIcon,
  PinIcon,
  ReceiptIcon,
  TagIcon,
  WalletIcon,
} from "@/components/Icons";

const FEATURES = [
  {
    icon: PinIcon,
    title: "Pick points on the map",
    text: "Click to set your pickup and drop-off, or type exact coordinates.",
  },
  {
    icon: TagIcon,
    title: "Know the fare first",
    text: "See the distance, the time and the price before you request a ride.",
  },
  {
    icon: WalletIcon,
    title: "Pay your way",
    text: "Pay by card or from your wallet, and use promo codes.",
  },
  {
    icon: ReceiptIcon,
    title: "Receipts by email",
    text: "Every paid ride gets a PDF receipt in your inbox.",
  },
];

function RoleCard({ icon: Icon, title, text, actions }) {
  return (
    <Card className="flex flex-col gap-4 p-6">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">{text}</p>
      </div>
      <div className="mt-auto flex flex-wrap gap-2">{actions}</div>
    </Card>
  );
}

export default function Home() {
  const { session, profile, profileError, loading } = useAuth();
  const isDriver = profile ? profile.role === "driver" : false;

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-zinc-400">
          <Spinner className="h-5 w-5" />
          Loading...
        </div>
      </main>
    );
  }

  if (session) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Welcome back
          </h1>
          <p className="mt-2 break-words text-slate-600 dark:text-zinc-400">
            Signed in as {session.user.email}
          </p>
        </div>

        {profileError && <Alert tone="error" className="mt-6">{profileError}</Alert>}

        <div className="mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
          <RoleCard
            icon={PinIcon}
            title="Ride"
            text="Request a ride, or top up your wallet."
            actions={
              <>
                <ButtonLink href="/book">Book a ride</ButtonLink>
                <ButtonLink href="/wallet" variant="secondary">
                  Wallet
                </ButtonLink>
              </>
            }
          />
          <RoleCard
            icon={CarIcon}
            title="Drive"
            text={
              isDriver
                ? "Open your driver dashboard."
                : "Register your vehicle to start driving."
            }
            actions={
              <ButtonLink href="/driver" variant={isDriver ? "primary" : "secondary"}>
                {isDriver ? "Open dashboard" : "Become a driver"}
              </ButtonLink>
            }
          />
        </div>
      </main>
    );
  }

  return (
    <main>
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-12 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            Cab Booking
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-6xl">
            Your ride,{" "}
            <span className="text-indigo-600 dark:text-indigo-400">
              on your terms.
            </span>
          </h1>
          <p className="mt-5 text-lg text-slate-600 dark:text-zinc-400">
            Choose your points on the map, see the fare before you book, and pay
            by card or from your wallet.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
          <RoleCard
            icon={PinIcon}
            title="I want to ride"
            text="Book in a few taps and see the fare first."
            actions={
              <>
                <ButtonLink href="/signup">Sign up as a rider</ButtonLink>
                <ButtonLink href="/login" variant="secondary">
                  Log in
                </ButtonLink>
              </>
            }
          />
          <RoleCard
            icon={CarIcon}
            title="I want to drive"
            text="Register your vehicle and take ride requests."
            actions={
              <>
                <ButtonLink href="/driver/signup">Sign up as a driver</ButtonLink>
                <ButtonLink href="/driver/login" variant="secondary">
                  Log in
                </ButtonLink>
              </>
            }
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <li key={feature.title}>
              <Card className="h-full p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
                  <feature.icon className="h-5 w-5" />
                </span>
                <h2 className="mt-4 font-semibold">{feature.title}</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                  {feature.text}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}