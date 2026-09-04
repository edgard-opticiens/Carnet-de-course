import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import DashboardShell from "@/components/DashboardShell";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session.accessToken) {
    redirect("/");
  }
  return <DashboardShell />;
}
