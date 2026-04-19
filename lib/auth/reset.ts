import { randomBytes, createHash } from "node:crypto";
import { getSql } from "@/lib/db";

const TOKEN_EXPIRY_MINUTES = 30;
const RATE_LIMIT_PER_HOUR = 5;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetToken(
  email: string,
): Promise<{ token: string } | { error: string }> {
  const sql = getSql();
  const recent = await sql`
    SELECT COUNT(*)::int AS count FROM password_reset_tokens
    WHERE email = ${email}
      AND created_at > NOW() - INTERVAL '1 hour'
  `;
  if ((recent[0]?.count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return { error: "Too many requests. Please try again later." };
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

  await sql`
    INSERT INTO password_reset_tokens (email, token_hash, expires_at)
    VALUES (${email}, ${tokenHash}, ${expiresAt})
  `;
  return { token };
}

export async function consumePasswordResetToken(
  token: string,
): Promise<{ email: string } | null> {
  const sql = getSql();
  const tokenHash = hashToken(token);
  const rows = await sql`
    SELECT id, email FROM password_reset_tokens
    WHERE token_hash = ${tokenHash}
      AND used = false
      AND expires_at > NOW()
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const row = rows[0];
  await sql`UPDATE password_reset_tokens SET used = true WHERE id = ${row.id}`;
  return { email: row.email as string };
}
