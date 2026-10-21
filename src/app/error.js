"use client";

import { useEffect } from "react";
import { Button, ButtonLink, Card } from "@/components/ui";

export default function ErrorPage({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <Card className="flex flex-col items-start gap-4 p-8">
        <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
        <p className="text-slate-600 dark:text-zinc-400">
          An unexpected error happened. You can try again, or go back home.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => reset()}>Try again</Button>
          <ButtonLink href="/" variant="secondary">
            Go home
          </ButtonLink>
        </div>
      </Card>
    </main>
  );
}