import Link from "next/link";

type Props = {
  message: string;
  backHref: string;
  backLabel: string;
};

/**
 * Standard "not found" / "invalid id" fallback card used by [id] routes.
 */
export default function NotFoundCard({ message, backHref, backLabel }: Props) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
        <p className="font-medium text-zinc-600 dark:text-zinc-400">{message}</p>
        <Link
          href={backHref}
          className="mt-4 inline-block font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          ← {backLabel}
        </Link>
      </div>
    </div>
  );
}
