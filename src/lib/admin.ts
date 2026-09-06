export const OWNER_EMAIL = "mattboyer725@gmail.com";

export type AdminRole =
  | "owner"
  | "platform_admin"
  | "tenant_admin"
  | "auditor"
  | "operator"
  | "buyer"
  | "viewer";

export type AdminPerm =
  | "console"
  | "users.write"
  | "users.suspend"
  | "identities.write"
  | "sessions.revoke"
  | "policies.write"
  | "agents.control"
  | "alerts.manage"
  | "flags.write"
  | "backup.export"
  | "backup.restore"
  | "desk.freeze"
  | "keys.write"
  | "security.write"
  | "tenants.write";

export const ADMIN_ROLES: AdminRole[] = [
  "owner",
  "platform_admin",
  "tenant_admin",
  "auditor",
  "operator",
  "buyer",
  "viewer",
];

const ROLE_PERMS: Record<AdminRole, AdminPerm[]> = {
  owner: [
    "console",
    "users.write",
    "users.suspend",
    "identities.write",
    "sessions.revoke",
    "policies.write",
    "agents.control",
    "alerts.manage",
    "flags.write",
    "backup.export",
    "backup.restore",
    "desk.freeze",
    "keys.write",
    "security.write",
    "tenants.write",
  ],
  platform_admin: [
    "console",
    "users.write",
    "users.suspend",
    "identities.write",
    "sessions.revoke",
    "policies.write",
    "agents.control",
    "alerts.manage",
    "flags.write",
    "backup.export",
    "backup.restore",
    "desk.freeze",
    "keys.write",
    "tenants.write",
  ],
  tenant_admin: ["console", "users.write", "users.suspend", "alerts.manage"],
  auditor: ["console", "backup.export"],
  operator: ["console", "agents.control", "alerts.manage"],
  buyer: [],
  viewer: [],
};

export const ACCESS_MATRIX: { perm: AdminPerm; label: string }[] = [
  { perm: "console", label: "Enter command" },
  { perm: "users.write", label: "Invite / edit seats" },
  { perm: "users.suspend", label: "Suspend seats" },
  { perm: "identities.write", label: "Change identity roles" },
  { perm: "sessions.revoke", label: "Revoke sessions" },
  { perm: "policies.write", label: "Edit gate policies" },
  { perm: "agents.control", label: "Restart / degrade agents" },
  { perm: "alerts.manage", label: "Ack / close alerts" },
  { perm: "flags.write", label: "Toggle feature flags" },
  { perm: "backup.export", label: "Export backup" },
  { perm: "backup.restore", label: "Restore backup" },
  { perm: "desk.freeze", label: "Freeze live desk" },
  { perm: "keys.write", label: "Issue / revoke API keys" },
  { perm: "security.write", label: "Security & maintenance" },
  { perm: "tenants.write", label: "Edit tenant licences" },
];

export function permissionsFor(role: AdminRole): AdminPerm[] {
  return ROLE_PERMS[role] ?? [];
}

export function can(role: AdminRole, perm: AdminPerm): boolean {
  return ROLE_PERMS[role]?.includes(perm) ?? false;
}

export function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.indexOf("@");
  if (at < 0) return trimmed;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return `${local.replace(/\./g, "").split("+")[0]}@gmail.com`;
  }
  return trimmed;
}

export function isOwnerIdentity(email?: string | null, name?: string | null): boolean {
  const e = (email ?? "").trim();
  const n = (name ?? "").trim().toLowerCase();
  if (e) {
    const norm = normalizeEmail(e);
    if (norm === OWNER_EMAIL) return true;
    if (norm.includes("mattboyer725")) return true;
    const local = norm.split("@")[0] ?? "";
    if (local === "mattboyer725") return true;
  }
  const compact = n.replace(/[^a-z]/g, "");
  if (compact === "mattboyer" || n.includes("matt boyer")) return true;
  return false;
}

export const CONSOLE_ROLES: AdminRole[] = [
  "owner",
  "platform_admin",
  "tenant_admin",
  "auditor",
  "operator",
];

export type Presence = "online" | "idle" | "offline";

export function presenceOf(iso: string | null | undefined, now = Date.now()): Presence {
  if (!iso) return "offline";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "offline";
  const d = now - t;
  if (d < 5 * 60_000) return "online";
  if (d < 30 * 60_000) return "idle";
  return "offline";
}
