"use client";

import { useState } from "react";

const enableDevAuth = process.env.NEXT_PUBLIC_ENABLE_TEST_LOGIN === "true";

type DevMode = "signin" | "signup" | "reset";
type FormState = "idle" | "loading" | "reset-sent" | "error";

export default function LoginPage() {
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState("");
  const [devMode, setDevMode] = useState<DevMode>("signin");
  const [devEmail, setDevEmail] = useState("");
  const [devPassword, setDevPassword] = useState("");

  const setDevModeSafe = (mode: DevMode) => {
    setDevMode(mode);
    setError("");
    setState("idle");
  };

  const handleDevAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setState("loading");

    if (devMode === "reset") {
      try {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: devEmail }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Could not send reset email");
        setState("reset-sent");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setState("error");
      }
      return;
    }

    try {
      const endpoint = devMode === "signup" ? "/api/auth/dev-signup" : "/api/auth/signin-password";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: devEmail, password: devPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Authentication failed");
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setState("error");
    }
  };

  if (!enableDevAuth) {
    return (
      <div style={wrapper}>
        <div style={card}>
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🧬</div>
          <h1 style={{ fontSize: "1.6rem", marginBottom: 4 }}>Sign in to BioSeq AI</h1>
          <p style={{ color: "#666", fontSize: "0.9rem" }}>
            Password sign-in is only enabled in preview and local development.
          </p>
        </div>
      </div>
    );
  }

  if (state === "reset-sent") {
    return (
      <div style={wrapper}>
        <div style={card}>
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>📬</div>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Check your email</p>
          <p style={{ color: "#666", fontSize: "0.9rem" }}>
            If an account exists for <strong>{devEmail}</strong>, we sent a password-reset link.
          </p>
          <button
            type="button"
            onClick={() => { setState("idle"); setDevModeSafe("signin"); setDevPassword(""); }}
            style={{ ...button, background: "transparent", color: "inherit", border: "1.5px solid rgba(0,0,0,0.15)", marginTop: 16 }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={wrapper}>
      <div style={card}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🧬</div>
          <h1 style={{ fontSize: "1.6rem", marginBottom: 4 }}>Sign in to BioSeq AI</h1>
          <p style={{ color: "#666", fontSize: "0.9rem" }}>Sign in with your email and password.</p>
        </div>

        <form onSubmit={handleDevAuth}>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 8,
              padding: 4,
              marginBottom: 16,
              border: "1.5px solid rgba(0,0,0,0.15)",
              borderRadius: 10,
            }}
          >
            <button
              type="button"
              onClick={() => setDevModeSafe("signin")}
              style={{
                ...tab,
                background: devMode === "signin" ? "var(--surface, #fff)" : "transparent",
                fontWeight: devMode === "signin" ? 600 : 500,
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setDevModeSafe("signup")}
              style={{
                ...tab,
                background: devMode === "signup" ? "var(--surface, #fff)" : "transparent",
                fontWeight: devMode === "signup" ? 600 : 500,
              }}
            >
              Create account
            </button>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="devEmail" style={labelStyle}>Email</label>
            <input
              id="devEmail"
              type="email"
              autoComplete="email"
              required
              value={devEmail}
              onChange={(e) => { setDevEmail(e.target.value); if (state === "error") setState("idle"); }}
              placeholder="you@example.com"
              style={input}
            />
          </div>

          {devMode !== "reset" && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <label htmlFor="devPassword" style={labelStyle}>Password</label>
                {devMode === "signin" && (
                  <button
                    type="button"
                    onClick={() => setDevModeSafe("reset")}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      fontSize: "0.75rem",
                      color: "#666",
                      textDecoration: "underline",
                      cursor: "pointer",
                    }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                id="devPassword"
                type="password"
                autoComplete={devMode === "signup" ? "new-password" : "current-password"}
                required
                minLength={6}
                value={devPassword}
                onChange={(e) => { setDevPassword(e.target.value); if (state === "error") setState("idle"); }}
                style={input}
              />
              {devMode === "signup" && (
                <p style={{ fontSize: "0.75rem", color: "#666", marginTop: 4 }}>At least 6 characters.</p>
              )}
            </div>
          )}

          {devMode === "reset" && (
            <p style={{ fontSize: "0.8rem", color: "#666", marginBottom: 12 }}>
              Enter your account email and we&apos;ll send a link to set a new password.
            </p>
          )}

          {state === "error" && error && (
            <p style={{ color: "#d94f3d", fontSize: "0.85rem", marginBottom: 12 }}>{error}</p>
          )}

          <button type="submit" disabled={state === "loading"} style={button}>
            {state === "loading"
              ? devMode === "signup"
                ? "Creating account…"
                : devMode === "reset"
                  ? "Sending link…"
                  : "Signing in…"
              : devMode === "signup"
                ? "Create account"
                : devMode === "reset"
                  ? "Send reset link"
                  : "Sign in"}
          </button>

          {devMode === "reset" && (
            <button
              type="button"
              onClick={() => setDevModeSafe("signin")}
              style={{ ...button, background: "transparent", color: "inherit", border: "1.5px solid rgba(0,0,0,0.15)", marginTop: 8 }}
            >
              Back to sign in
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

const wrapper = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 } as const;
const card = { width: "100%", maxWidth: 400, padding: 32, borderRadius: 14, border: "1.5px solid rgba(0,0,0,0.1)", background: "var(--surface, #fff)" };
const tab = { flex: 1, padding: "6px 12px", borderRadius: 6, fontSize: "0.85rem", border: "none", cursor: "pointer" } as const;
const labelStyle = { display: "block", fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4 };
const input = { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid rgba(0,0,0,0.15)", fontSize: "1rem" };
const button = { width: "100%", padding: "10px 18px", borderRadius: 99, border: "none", background: "var(--bark, #3d2b1f)", color: "#fff", fontWeight: 600, cursor: "pointer" };
