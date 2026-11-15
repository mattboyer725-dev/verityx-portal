export const passportKeys = {
  all: ["vx", "passports"] as const,
  one: (id: string) => ["vx", "passports", id] as const,
  portfolio: (program: string) => ["vx", "portfolio", program] as const,
};
