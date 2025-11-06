"use client";

// Better Auth doesn't need a provider - hooks work directly
export function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}