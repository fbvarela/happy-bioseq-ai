"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setMessage("Reset link is missing its token. Request a new one.");
      setState("error");
      return;
    }
    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      setState("error");
      return;
    }
    if (password !== confirm) {
      setMessage("Passwords do not match.");
      setState("error");
      return;
    }

    setState("loading");
    setMessage("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to update password");
      setState("done");
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to update password.");
      setState("error");
    }
  };

  if (!token) {
    return (
      <div style={wrapper}>
        <div style={card}>
          <h1 style={{ fontSize: "1.4rem", marginBottom: 8 }}>Reset link missing</h1>
          <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: 16 }}>
            This reset link is invalid. Request a new one from the sign-in page.
          </p>
          <a href="/login" style={link}>Back to sign in</a>
        </div>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div style={wrapper}>
        <div style={card}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>✅</div>
          <h1 style={{ fontSize: "1.4rem", marginBottom: 8 }}>Password updated</h1>
          <p style={{ color: "#666", fontSize: "0.9rem" }}>Redirecting you…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={wrapper}>
      <div style={card}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🧬</div>
          <h1 style={{ fontSize: "1.4rem", marginBottom: 4 }}>Choose a new password</h1>
          <p style={{ color: "#666", fontSize: "0.9rem" }}>Enter a new password for your account.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="password" style={labelStyle}>New password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (state === "error") setState("idle"); }}
              style={input}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="confirm" style={labelStyle}>Confirm password</label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); if (state === "error") setState("idle"); }}
              style={input}
            />
          </div>
          {state === "error" && message && (
            <p style={{ color: "#d94f3d", fontSize: "0.85rem", marginBottom: 12 }}>{message}</p>
          )}
          <button type="submit" disabled={state === "loading"} style={button}>
            {state === "loading" ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}

const wrapper = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
} as const;

const card = {
  width: "100%",
  maxWidth: 400,
  padding: 32,
  borderRadius: 14,
  border: "1.5px solid rgba(0,0,0,0.1)",
  background: "var(--surface, #fff)",
  textAlign: "center" as const,
};

const labelStyle = {
  display: "block",
  fontSize: "0.8rem",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  marginBottom: 4,
  textAlign: "left" as const,
};

const input = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1.5px solid rgba(0,0,0,0.15)",
  fontSize: "1rem",
  background: "var(--bg, #fff)",
};

const button = {
  width: "100%",
  padding: "10px 18px",
  borderRadius: 99,
  border: "none",
  background: "var(--bark, #3d2b1f)",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

const link = {
  display: "inline-block",
  padding: "10px 18px",
  borderRadius: 99,
  background: "transparent",
  border: "1.5px solid rgba(0,0,0,0.15)",
  color: "inherit",
  textDecoration: "none",
};
