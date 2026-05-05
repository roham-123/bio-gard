"use client";

type SummaryRow = {
  label: string;
  value: string;
};

type Props = {
  title: string;
  rows: SummaryRow[];
  muted?: boolean;
};

export default function CostSummaryCard({ title, rows, muted = false }: Props) {
  const valueClass = `font-semibold tabular-nums ${
    muted ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-900 dark:text-zinc-100"
  }`;

  return (
    <div className="rounded-xl border-2 border-zinc-200 bg-zinc-50/80 p-6 shadow-md dark:border-zinc-600 dark:bg-zinc-800/50">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
        {title}
      </h2>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4 sm:block">
            <dt className="font-medium text-zinc-600 dark:text-zinc-400">{row.label}</dt>
            <dd className={valueClass}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
