"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const LINKS = [
  { href: "/",              label: "Analyze",  match: (p: string, s: URLSearchParams) => p === "/" && s.get("tab") !== "variant" },
  { href: "/?tab=variant",  label: "Variants", match: (p: string, s: URLSearchParams) => p === "/" && s.get("tab") === "variant" },
  { href: "/history",       label: "History",  match: (p: string) => p === "/history" },
];

function Links() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <>
      {LINKS.map(({ href, label, match }) => {
        const active = match(pathname, searchParams);
        return (
          <Link
            key={href}
            href={href}
            className={`transition-colors text-sm ${
              active
                ? "text-white font-medium"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}

export default function NavLinks() {
  return (
    <Suspense fallback={null}>
      <Links />
    </Suspense>
  );
}
