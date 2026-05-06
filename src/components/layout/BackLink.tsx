import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  href: string;
  children: ReactNode;
};

export default function BackLink({ href, children }: Props) {
  return (
    <Link
      href={href}
      className="mb-4 inline-block font-medium text-emerald-600 hover:underline dark:text-emerald-400"
    >
      ← {children}
    </Link>
  );
}
