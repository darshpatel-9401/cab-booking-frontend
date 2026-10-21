import { cx } from "@/components/ui";

const LABELS = {
  live: "Live",
  connecting: "Connecting...",
  reconnecting: "Reconnecting...",
  offline: "Updates paused",
};

export default function LiveIndicator({ status }) {
  const dot =
    status === "live"
      ? "bg-emerald-500"
      : status === "offline"
        ? "bg-slate-400"
        : "bg-amber-500";

  return (
    <span
      role="status"
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900"
    >
      <span aria-hidden="true" className={cx("h-2 w-2 rounded-full", dot)} />
      {LABELS[status] || status}
    </span>
  );
}