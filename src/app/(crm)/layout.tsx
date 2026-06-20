import { AppSidebar } from "@/components/app-sidebar";
import { getOptionalSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function CrmLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getOptionalSession();

  if (!session) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
