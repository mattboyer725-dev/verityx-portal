import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/components/admin-console";

export const Route = createFileRoute("/admin")({ component: AdminPage });
