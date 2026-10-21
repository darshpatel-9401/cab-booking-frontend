import { ButtonLink, Card } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <Card className="flex flex-col items-start gap-4 p-8">
        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
          404
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
        <p className="text-slate-600 dark:text-zinc-400">
          The page you are looking for does not exist or has moved.
        </p>
        <ButtonLink href="/">Go home</ButtonLink>
      </Card>
    </main>
  );
}