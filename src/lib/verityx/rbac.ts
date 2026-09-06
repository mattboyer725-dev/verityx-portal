import type { Role } from "./types.ts";

export const ACTIONS = {
  "prospect.write": ["founder", "admin", "analyst"],
  "prospect.delete": ["founder", "admin"],
  "pilot.write": ["founder", "admin", "analyst"],
  "payment.manual": ["founder", "admin"],
  "payment.checkout": ["founder", "admin", "analyst"],
  "decision.write": ["founder", "admin", "analyst"],
  "decision.approve": ["founder", "admin"],
  "report.write": ["founder", "admin", "analyst"],
  "learning.write": ["founder", "admin", "analyst"],
  "org.write": ["founder", "admin"],
  "audit.read": ["founder", "admin", "analyst", "viewer"],
} as const;

export type Action = keyof typeof ACTIONS;

export function can(role: Role, action: Action): boolean {
  return (ACTIONS[action] as readonly string[]).includes(role);
}

export function assertCan(role: Role, action: Action): void {
  if (!can(role, action)) {
    throw new Error("Forbidden");
  }
}
