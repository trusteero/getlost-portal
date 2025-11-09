import DashboardLayout from "@/components/dashboard-layout";

// Force dynamic rendering to prevent prerendering errors with React hooks
export const dynamic = 'force-dynamic';

export default function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
