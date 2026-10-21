"use client";

import { useAuth } from "@/components/AuthProvider";
import { Alert, ButtonLink, Card, Spinner } from "@/components/ui";

function Shell({ children }) {
  return <main className="mx-auto w-full max-w-3xl px-4 py-10">{children}</main>;
}

export default function RequireAuth({ title, loginHref, signupHref, children }) {
  const { session, profile, profileError, loading } = useAuth();

  if (loading) {
    return (
      <Shell>
        <Card className="flex items-center gap-3 p-6 text-sm text-slate-600 dark:text-zinc-400">
          <Spinner className="h-5 w-5" />
          Loading...
        </Card>
      </Shell>
    );
  }

  if (!session) {
    return (
      <Shell>
        <Card className="flex flex-col gap-4 p-8">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-slate-600 dark:text-zinc-400">
            Log in to continue.
          </p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={loginHref}>Log in</ButtonLink>
            <ButtonLink href={signupHref} variant="secondary">
              Sign up
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
          <Card className="flex items-center gap-3 p-6 text-sm text-slate-600 dark:text-zinc-400">
            <Spinner className="h-5 w-5" />
            Setting up your account...
          </Card>
        )}
      </Shell>
    );
  }

  return children;
}