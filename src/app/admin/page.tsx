import React from "react";
import { redirect } from "next/navigation";
import { getDashboardData } from "@/lib/db";
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const data = await getDashboardData();

  if (!data) {
    redirect("/login");
  }

  return <AdminDashboardClient initialData={data} />;
}
