"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import {
  Alert,
  Button,
  Card,
  Field,
  FOCUS,
  Input,
  Spinner,
  cx,
  describedBy,
  inputClasses,
} from "@/components/ui";
import { CarIcon, CheckIcon, EyeIcon, EyeOffIcon } from "@/components/Icons";

const PATHS = {
  rider: {
    login: "/login",
    signup: "/signup",
    destination: "/book",
    otherName: "driver",
    otherLogin: "/driver/login",
    otherPrompt: "Want to drive instead?",
    otherLabel: "Driver login",
  },
  driver: {
    login: "/driver/login",
    signup: "/driver/signup",
    destination: "/driver",
    otherName: "rider",
    otherLogin: "/login",
    otherPrompt: "Looking to ride instead?",
    otherLabel: "Rider login",
  },
};

const COPY = {
  rider: {
    login: {
      title: "Welcome back",
      subtitle: "Log in to book your next ride.",
      button: "Log in",
      busy: "Logging in...",
    },
    signup: {
      title: "Create your rider account",
      subtitle: "Get a fare estimate and book in a few taps.",
      button: "Create account",
      busy: "Creating account...",
    },
  },
  driver: {
    login: {
      title: "Driver login",
      subtitle: "Log in to your driver dashboard.",
      button: "Log in",
      busy: "Logging in...",
    },
    signup: {
      title: "Create your driver account",
      subtitle: "Sign up now. You will add your vehicle on the next screen.",
      button: "Create account",
      busy: "Creating account...",
    },
  },
};

const BENEFITS = {
  rider: [
    "See the fare before you book",
    "Pay by card or from your wallet",
    "Use promo codes and get email receipts",
  ],
  driver: [
    "Go online whenever you want",
    "Get matched with riders near you",
    "Start and complete rides in one place",
  ],
};

function friendlyError(message) {
  const text = (message || "").toLowerCase();
  if (text.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }
  if (text.includes("email not confirmed")) {
    return "Please confirm your email first. Check your inbox.";
  }
  if (text.includes("already registered")) {
    return "An account with this email already exists. Try logging in.";
  }
  if (text.includes("rate limit")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (text.includes("fetch") || text.includes("network")) {
    return "Could not reach the server. Check your connection.";
  }
  return message || "Something went wrong. Please try again.";
}

export default function AuthForm({ portal, mode }) {
  const router = useRouter();
  const { session, loading } = useAuth();
  const paths = PATHS[portal];
  const copy = COPY[portal][mode];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!loading && session) {
      router.replace(paths.destination);
    }
  }, [loading, session, router, paths.destination]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (mode === "signup" && password.length < 6) {
      setError("Your password must be at least 6 characters.");
      return;
    }
    if (mode === "signup" && password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (signInError) {
          setError(friendlyError(signInError.message));
        }
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });
        if (signUpError) {
          setError(friendlyError(signUpError.message));
        } else if (!data.session) {
          setNotice("Check your email to confirm your account, then log in.");
        }
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    }
    setBusy(false);
  }

  if (loading || session) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-zinc-400">
          <Spinner className="h-5 w-5" />
          {session ? "Signing you in..." : "Loading..."}
        </div>
      </main>
    );
  }

  const passwordType = showPassword ? "text" : "password";

  return (
    <main className="mx-auto grid min-h-[calc(100vh-4.5rem)] w-full max-w-6xl gap-10 px-4 py-8 lg:grid-cols-2">
      <aside className="hidden flex-col justify-between rounded-3xl bg-[linear-gradient(135deg,#4f46e5,#7c3aed)] p-10 text-white lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
            <CarIcon className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold">Cab Booking</span>
        </div>
        <div>
          <h2 className="text-3xl font-bold leading-tight">
            {portal === "driver"
              ? "Drive when it suits you."
              : "Get where you are going."}
          </h2>
          <ul className="mt-6 flex flex-col gap-3">
            {BENEFITS[portal].map((benefit) => (
              <li key={benefit} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                  <CheckIcon className="h-4 w-4" />
                </span>
                {benefit}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/80">
          One account system, two doors: riders and drivers.
        </p>
      </aside>

      <div className="flex items-center justify-center">
        <Card className="w-full max-w-md p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight">{copy.title}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            {copy.subtitle}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <Input
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Field
              id="password"
              label="Password"
              hint={mode === "signup" ? "At least 6 characters." : undefined}
            >
              <div className="relative">
                <input
                  id="password"
                  type={passwordType}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-describedby={describedBy(
                    "password",
                    mode === "signup" ? "hint" : undefined,
                    undefined
                  )}
                  required
                  className={cx(
                    inputClasses,
                    "border-slate-300 pr-11 dark:border-zinc-700"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className={cx(
                    "absolute inset-y-0 right-1.5 my-auto flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
                    FOCUS
                  )}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </Field>

            {mode === "signup" && (
              <Input
                id="confirm"
                label="Confirm password"
                type={passwordType}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            )}

            {error && <Alert tone="error">{error}</Alert>}
            {notice && <Alert tone="success">{notice}</Alert>}

            <Button type="submit" size="lg" loading={busy}>
              {busy ? copy.busy : copy.button}
            </Button>
          </form>

          <div className="mt-6 flex flex-col gap-2 border-t border-slate-200 pt-5 text-sm dark:border-zinc-800">
            {mode === "login" ? (
              <p>
                New here?{" "}
                <Link
                  href={paths.signup}
                  className={cx("font-semibold text-indigo-600 underline underline-offset-4 dark:text-indigo-400", FOCUS)}
                >
                  Create an account
                </Link>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <Link
                  href={paths.login}
                  className={cx("font-semibold text-indigo-600 underline underline-offset-4 dark:text-indigo-400", FOCUS)}
                >
                  Log in
                </Link>
              </p>
            )}
            <p className="text-slate-600 dark:text-zinc-400">
              {paths.otherPrompt}{" "}
              <Link
                href={paths.otherLogin}
                className={cx("font-semibold text-indigo-600 underline underline-offset-4 dark:text-indigo-400", FOCUS)}
              >
                {paths.otherLabel}
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}