export const passportKeys = {
  all: ["vx", "passports"] as const,
  one: (id: string) => ["vx", "passports", id] as const,
};
