"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import CurrencySwitcher from "./CurrencySwitcher";

const links = [
  { href: "/po-history", label: "PO History" },
  { href: "/stock-summary", label: "Stock Summary" },
  { href: "/fx-rates", label: "FX Rates" },
];

const productLinks = [
  { href: "/recipes", label: "Formulas" },
  { href: "/finished-products", label: "Finished Products" },
];

export default function TopNav() {
  const pathname = usePathname();
  const [productsOpen, setProductsOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const productsActive =
    pathname === "/" ||
    pathname.startsWith("/recipes") ||
    pathname.startsWith("/finished-products");

  return (
    <nav className="border-b border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-800">
      <div className="mx-auto flex max-w-[90rem] items-center gap-8 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="py-4 text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          Bio Gard
        </Link>
        <div className="flex flex-1 items-center gap-1">
          <div
            className="relative"
            onMouseEnter={() => setProductsOpen(true)}
            onMouseLeave={() => setProductsOpen(false)}
          >
            <button
              type="button"
              onClick={() => setProductsOpen((open) => !open)}
              className={[
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                productsActive
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100",
              ].join(" ")}
              aria-expanded={productsOpen}
            >
              Products
            </button>
            {productsOpen && (
              <div className="absolute left-0 top-full z-20 -mt-1 pt-2">
                {/* Slight overlap + padding keeps pointer inside hover zone while moving off the trigger */}
                <div className="min-w-48 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                  {productLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setProductsOpen(false)}
                      className={[
                        "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
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
            )}
          </div>
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
        <div className="ml-auto flex shrink-0 items-center">
          <CurrencySwitcher />
        </div>
      </div>
    </nav>
  );
}
