"use client";

import { useState } from "react";
import type { Ingredient, PackagingItem } from "@/lib/db";
import PageShell from "@/components/layout/PageShell";
import MaterialsSection from "./MaterialsSection";
import PackagingSection from "./PackagingSection";

type Tab = "materials" | "packaging";

type Props = {
  initialIngredients: Ingredient[];
  initialPackagingItems: PackagingItem[];
};

export default function DatabasePage({
  initialIngredients,
  initialPackagingItems,
}: Props) {
  const [tab, setTab] = useState<Tab>("materials");

  return (
    <PageShell>
      <header className="border-b border-zinc-200 pb-6 dark:border-zinc-600">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          Database
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage the master lists used by every formula and product — materials
          (bacteria &amp; fillers) and packaging items.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-1 border-b border-zinc-200 dark:border-zinc-600">
        {(
          [
            { value: "materials", label: `Materials (${initialIngredients.length})` },
            { value: "packaging", label: `Packaging (${initialPackagingItems.length})` },
          ] as { value: Tab; label: string }[]
        ).map((opt) => {
          const active = tab === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTab(opt.value)}
              className={[
                "-mb-px rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300"
                  : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
              ].join(" ")}
              aria-selected={active}
              role="tab"
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {tab === "materials" ? (
          <MaterialsSection initialIngredients={initialIngredients} />
        ) : (
          <PackagingSection initialPackagingItems={initialPackagingItems} />
        )}
      </div>
    </PageShell>
  );
}
