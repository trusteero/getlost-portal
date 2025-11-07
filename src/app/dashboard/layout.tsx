// Force dynamic rendering - dashboard page requires authentication
export const dynamic = 'force-dynamic';

import DashboardLayout from "@/components/dashboard-layout";

export default function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
