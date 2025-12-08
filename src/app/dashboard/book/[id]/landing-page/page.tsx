 "use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

interface LandingPage {
  id: string;
  slug: string;
  title: string;
  headline: string;
  subheadline: string;
  description: string;
  htmlContent: string;
  isPublished: boolean;
  publishedAt?: string;
  status: string;
}

export default function LandingPageView() {
  const params = useParams();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const bookId = params.id as string;
  const [landingPage, setLandingPage] = useState<LandingPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    } else if (session) {
      fetchLandingPage();
    }
  }, [session, isPending, bookId]);

  const fetchLandingPage = async () => {
    try {
      const response = await fetch(`/api/books/${bookId}/landing-page`);
      if (response.ok) {
        const data = await response.json();
        setLandingPage(data);
      } else if (response.status === 403) {
        // Feature not unlocked, redirect back
        router.push("/dashboard");
      } else if (response.status === 404) {
        // Landing page doesn't exist yet
        setLandingPage(null);
      }
    } catch (error) {
      console.error("Failed to fetch landing page:", error);
    } finally {
      setLoading(false);
    }
  };

  if (isPending || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  // If no landing page exists yet, redirect to dashboard
  if (!landingPage) {
    router.push("/dashboard");
    return null;
  }

  // When landing page HTML exists, render it full-screen in an iframe without any chrome
  let htmlContent = landingPage.htmlContent || "";
  
  // Inject base tag for proper URL resolution (especially for videos)
  if (htmlContent && typeof htmlContent === 'string') {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    
    // Remove any existing base tags first
    htmlContent = htmlContent.replace(/<base[^>]*>/gi, '');
    
    // Inject base tag right after <head> tag
    htmlContent = htmlContent.replace(
      /<head([^>]*)>/i,
      `<head$1><base href="${origin}">`
    );
  }
  
  return (
    <div className="w-full h-screen bg-white">
      <iframe
        title={landingPage.title || "Landing Page"}
        srcDoc={htmlContent}
        sandbox="allow-scripts allow-same-origin"
        className="w-full h-full border-0 bg-white"
        style={{ 
          width: '100%', 
          height: '100vh'
        }}
      />
    </div>
  );
}

