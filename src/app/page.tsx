import { redirect } from "next/navigation";
import { getSession } from "@/server/auth";

// Force dynamic rendering since we need auth check
export const dynamic = 'force-dynamic';

export default async function Home() {
  // Check if user is already logged in
  let session = null;
  try {
    session = await getSession();
  } catch (error) {
    // During build or if auth fails, treat as no session
    session = null;
  }

  // If user is logged in, redirect to dashboard
  if (session?.user) {
    redirect("/dashboard");
  }

  // Otherwise, redirect to login
  redirect("/login");
}
