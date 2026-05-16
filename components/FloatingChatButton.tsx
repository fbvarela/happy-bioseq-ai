"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function FloatingChatButton() {
  const pathname = usePathname();
  if (pathname === "/chat" || pathname?.startsWith("/chat/")) return null;
  return (
    <Link
      href="/chat"
      aria-label="Open AI chat"
      style={{
        position: "fixed",
        bottom: "80px",
        right: "20px",
        width: 52,
        height: 52,
        borderRadius: "50%",
        background: "#16a34a",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        zIndex: 999,
        textDecoration: "none",
        fontSize: 22,
      }}
    >
      💬
    </Link>
  );
}
