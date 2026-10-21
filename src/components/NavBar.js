"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Button, ButtonLink, FOCUS, cx } from "@/components/ui";
import { CarIcon } from "@/components/Icons";

function isActive(pathname, href, exact = false) {
  if (pathname === href) {
    return true;
  }
  return !exact && pathname.startsWith(`${href}/`);
}

function NavLink({ href, active, children }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
        FOCUS
      )}
    >
      {children}
    </Link>
  );
}

export default function NavBar() {
  const { session, profile, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const inDriver = isActive(pathname, "/driver");
  const isDriver = profile ? profile.role === "driver" : false;

  let links;
  if (!session) {
    links = inDriver
      ? [{ href: "/login", label: "Ride with us" }]
      : [{ href: "/driver/login", label: "Drive with us" }];
  } else if (inDriver) {
    links = [
      { href: "/driver", label: "Dashboard", exact: true },
      { href: "/driver/rides", label: "Ride history" },
      { href: "/book", label: "Rider app" },
    ];
  } else {
    links = [
      { href: "/book", label: "Book a ride" },
      { href: "/rides", label: "My rides" },
      { href: "/wallet", label: "Wallet" },
      {
        href: "/driver",
        label: isDriver ? "Driver dashboard" : "Drive with us",
        exact: true,
      },
    ];
  }

  const loginHref = inDriver ? "/driver/login" : "/login";
  const signupHref = inDriver ? "/driver/signup" : "/signup";

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
    router.push(inDriver ? "/driver/login" : "/login");
  }

  const email = session ? session.user.email || "" : "";

  return (
    <header className="sticky top-0 z-[1100] border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
      >
        <Link
          href="/"
          aria-current={pathname === "/" ? "page" : undefined}
          className={cx("flex items-center gap-2 rounded-lg", FOCUS)}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <CarIcon className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">Cab Booking</span>
        </Link>

        {!loading && (
          <ul className="order-last flex w-full items-center gap-1 overflow-x-auto sm:order-none sm:ml-4 sm:w-auto">
            {links.map((link) => (
              <li key={link.href}>
                <NavLink
                  href={link.href}
                  active={isActive(pathname, link.href, link.exact)}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        )}

        {!loading && !session && (
          <div className="ml-auto flex items-center gap-2">
            <ButtonLink href={loginHref} variant="ghost" size="sm">
              Log in
            </ButtonLink>
            <ButtonLink href={signupHref} size="sm">
              Sign up
            </ButtonLink>
          </div>
        )}

        {!loading && session && (
          <div className="ml-auto flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
            >
              {email.charAt(0).toUpperCase() || "?"}
            </span>
            <span
              className="hidden max-w-[12rem] truncate text-sm text-slate-600 dark:text-zinc-400 md:inline"
              title={email}
            >
              {email}
            </span>
            {profile && (
              <Badge tone={isDriver ? "indigo" : "neutral"}>
                {isDriver ? "Driver" : "Rider"}
              </Badge>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSignOut}
              loading={signingOut}
            >
              Log out
            </Button>
          </div>
        )}
      </nav>
    </header>
  );
}