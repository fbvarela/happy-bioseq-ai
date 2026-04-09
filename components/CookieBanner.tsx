"use client";
import { useState, useEffect } from "react";

const STORAGE_KEY = "hf_cookie_consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  function respond(accepted: boolean) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted, ts: new Date().toISOString() }));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-2 left-2 right-2 z-[9999] sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-[420px] animate-[slideUp_0.25s_ease] bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-lg shadow-black/30">
      <div className="flex gap-3 items-start">
        <span className="text-2xl shrink-0">🍪</span>
        <p className="text-xs leading-relaxed text-gray-400">
          We use cookies to improve your experience. By continuing, you accept our use of cookies.
        </p>
      </div>
      <div className="flex gap-2 mt-3 justify-end">
        <button
          onClick={() => respond(false)}
          className="text-xs px-3 py-1 rounded-md border border-gray-700 text-gray-400 cursor-pointer hover:bg-gray-800 transition-colors"
        >
          Reject
        </button>
        <button
          onClick={() => respond(true)}
          className="text-xs px-3 py-1 rounded-md cursor-pointer bg-green-600 text-white hover:bg-green-500 transition-colors"
        >
          Accept
        </button>
      </div>
    </div>
  );
}

export function getCookieConsent() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}
