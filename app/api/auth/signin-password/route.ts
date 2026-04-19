import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionUser } from "@/lib/auth/session";

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

  const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`SELECT id, email, password_hash FROM users WHERE email = ${email} LIMIT 1`;
  const user = rows[0] as { id: string; email: string; password_hash: string | null } | undefined;
  const ok = await verifyPassword(password, user?.password_hash);
  if (!user || !ok) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await setSessionUser({ userId: user.id, email: user.email });
  return NextResponse.json({ ok: true });
}
