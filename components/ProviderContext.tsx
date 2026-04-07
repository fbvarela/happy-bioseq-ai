"use client";

import { createContext, useContext, useState } from "react";
import type { AIProvider } from "@/lib/ai";

interface ProviderCtx {
  provider: AIProvider;
  setProvider: (p: AIProvider) => void;
}

const Ctx = createContext<ProviderCtx>({ provider: "claude", setProvider: () => {} });

export function ProviderProvider({ children }: { children: React.ReactNode }) {
  const [provider, setProvider] = useState<AIProvider>("claude");
  return <Ctx.Provider value={{ provider, setProvider }}>{children}</Ctx.Provider>;
}

export function useProvider() {
  return useContext(Ctx);
}

export function ProviderToggle() {
  const { provider, setProvider } = useProvider();
  return (
    <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
      {(["claude", "cohere"] as AIProvider[]).map((p) => (
        <button
          key={p}
          onClick={() => setProvider(p)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            provider === p
              ? "bg-green-600 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          {p === "claude" ? "Claude" : "Cohere"}
        </button>
      ))}
    </div>
  );
}
