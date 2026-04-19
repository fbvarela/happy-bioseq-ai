import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { createPasswordResetToken, consumePasswordResetToken } from "@/lib/auth/reset";
import { hashPassword } from "@/lib/auth/password";
import { setSessionUser } from "@/lib/auth/session";

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_ENABLE_TEST_LOGIN !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { email?: unknown; token?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Flow 2: consume token + set new password
  if (typeof body.token === "string" && typeof body.password === "string") {
    if (body.password.length < 6 || body.password.length > 128) {
      return NextResponse.json({ error: "Password must be 6–128 characters" }, { status: 400 });
    }

    const result = await consumePasswordResetToken(body.token);
    if (!result) {
      return NextResponse.json({ error: "Reset link is invalid or has expired" }, { status: 400 });
    }

    const sql = getSql();
    const passwordHash = await hashPassword(body.password);
    const existing = await sql`SELECT id FROM users WHERE email = ${result.email} LIMIT 1`;
    let userRow: { id: string; email: string };
    if (existing.length > 0) {
      const updated = await sql`
        UPDATE users SET password_hash = ${passwordHash} WHERE id = ${existing[0].id}
        RETURNING id, email
      `;
      userRow = updated[0] as { id: string; email: string };
    } else {
      const inserted = await sql`
        INSERT INTO users (email, password_hash) VALUES (${result.email}, ${passwordHash})
        RETURNING id, email
      `;
      userRow = inserted[0] as { id: string; email: string };
    }

    await setSessionUser({ userId: userRow.id, email: userRow.email });
    return NextResponse.json({ ok: true });
  }

  // Flow 1: send reset email (dev: logs the URL; prod: wire Resend later)
  const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const result = await createPasswordResetToken(email);
  if ("error" in result) {
    return NextResponse.json({ sent: true });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const resetUrl = `${appUrl}/auth/reset-password?token=${result.token}`;
  console.log(`\n🔐 PASSWORD RESET (dev)\n  To: ${email}\n  ${resetUrl}\n`);

  return NextResponse.json({ sent: true });
}
