"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Products" },
  { href: "/po-history", label: "PO History" },
];

export default function TopNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav className="border-b border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-800">
      <div className="mx-auto flex max-w-[90rem] items-center gap-8 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="py-4 text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          Bio Gard
        </Link>
        <div className="flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={[
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(link.href)
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100",
              ].join(" ")}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
