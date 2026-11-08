// Minimal config for the ledger race test: only the "@" alias, no app plugins.
import { fileURLToPath } from "node:url";
export default { resolve: { alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)) } } };
