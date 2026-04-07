"use client";

export default function SetupButton() {
  async function setup() {
    const res = await fetch("/api/setup", { method: "POST" });
    if (res.ok) alert("Database ready.");
    else alert("Setup failed — check server logs.");
  }
  return (
    <button
      onClick={setup}
      className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
    >
      Setup DB
    </button>
  );
}
