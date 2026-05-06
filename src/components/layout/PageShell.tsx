import type { ReactNode } from "react";

type Width = "default" | "narrow";

const WIDTH_CLASS: Record<Width, string> = {
  default: "max-w-[90rem]",
  narrow: "max-w-3xl",
};

type Props = {
  children: ReactNode;
  width?: Width;
};

/**
 * Standard outer page wrapper used by every top-level page in the app.
 * Renders a centered card on a padded container.
 */
export default function PageShell({ children, width = "default" }: Props) {
  return (
    <div className={`mx-auto ${WIDTH_CLASS[width]} px-4 py-8 sm:px-6 lg:px-8`}>
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 sm:p-8">
        {children}
      </div>
    </div>
  );
}
