"use client";

import { useState } from "react";

export default function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      className="text-xs text-gray-500 hover:text-gray-300 transition-colors border border-gray-700 px-2 py-1 rounded-md"
    >
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}
