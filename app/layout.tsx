import type { Metadata } from "next";
import "./globals.css";
import SetupButton from "@/components/SetupButton";
import { ProviderProvider, ProviderToggle } from "@/components/ProviderContext";
import NavLinks from "@/components/NavLinks";

export const metadata: Metadata = {
  title: "BioSeq AI — Sequence Analysis Assistant",
  description:
    "AI-powered DNA, RNA, and protein sequence analysis for researchers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950">
        <ProviderProvider>
          <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
              <a href="/" className="flex items-center gap-2">
                <span className="text-green-400 font-bold text-lg tracking-tight">
                  BioSeq<span className="text-white">AI</span>
                </span>
                <span className="text-xs text-gray-500 border border-gray-700 px-2 py-0.5 rounded-full">
                  beta
                </span>
              </a>
              <div className="flex items-center gap-6">
                <NavLinks />
                <ProviderToggle />
                <SetupButton />
              </div>
            </div>
          </nav>
          <main>{children}</main>
        </ProviderProvider>
      </body>
    </html>
  );
}
