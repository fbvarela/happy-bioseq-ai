import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";

export interface SessionData {
  userId?: string;
  email?: string;
}

function getSessionOptions(): SessionOptions {
  return {
    password: getEnv("SESSION_SECRET") || "dev_only_insecure_password_replace_me_32chars!!",
    cookieName: "bioseq_session",
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    },
  };
}

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, getSessionOptions());
}

export async function setSessionUser({ userId, email }: { userId: string; email: string }) {
  const session = await getSession();
  session.userId = userId;
  session.email = email;
  await session.save();
}

export async function clearSession() {
  const session = await getSession();
  session.destroy();
}
