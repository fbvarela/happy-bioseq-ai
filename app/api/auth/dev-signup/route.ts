import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { setSessionUser } from "@/lib/auth/session";

function isValidEmail(v: unknown): v is string {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isValidPassword(v: unknown): v is string {
  return typeof v === "string" && v.length >= 6 && v.length <= 128;
}

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_ENABLE_TEST_LOGIN !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isValidEmail(body.email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (!isValidPassword(body.password)) {
    return NextResponse.json({ error: "Password must be 6–128 characters" }, { status: 400 });
  }

  const sql = getSql();
  const email = body.email.toLowerCase().trim();
  const passwordHash = await hashPassword(body.password);

  const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
  let userRow: { id: string; email: string };
  let action: "created" | "updated";
  if (existing.length > 0) {
    const updated = await sql`
      UPDATE users SET password_hash = ${passwordHash} WHERE id = ${existing[0].id}
      RETURNING id, email
    `;
    userRow = updated[0] as { id: string; email: string };
    action = "updated";
  } else {
    const inserted = await sql`
      INSERT INTO users (email, password_hash) VALUES (${email}, ${passwordHash})
      RETURNING id, email
    `;
    userRow = inserted[0] as { id: string; email: string };
    action = "created";
  }

  await setSessionUser({ userId: userRow.id, email: userRow.email });

  return NextResponse.json({ ok: true, action, userId: userRow.id });
}
