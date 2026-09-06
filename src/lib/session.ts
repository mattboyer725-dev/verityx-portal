import { BUYER } from "@/lib/engine";

export const SESSION_KEY = "vx-desk-session";

export type DeskSession = {
  email: string;
  at: number;
  access_token?: string;
  iss?: string;
  sub?: string;
};

export function hasSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw) as DeskSession;
    return s.email === BUYER.email;
  } catch {
    return false;
  }
}
