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
