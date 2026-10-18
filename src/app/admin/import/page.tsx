import { redirect } from "next/navigation";
import { getIsAdmin } from "@/lib/profile";
import { AdminImport } from "./AdminImport";

export default async function AdminImportPage() {
  if (!(await getIsAdmin())) redirect("/dashboard");
  return <AdminImport />;
}
