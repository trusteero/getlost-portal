 "use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  // If no landing page exists yet, show a very minimal placeholder with a back button.
  if (!landingPage) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="p-4">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500 text-sm">
            Landing page is not available yet for this book.
          </p>
        </div>
      </div>
    );
  }

  // When landing page HTML exists, render it full-screen in an iframe with minimal chrome,
  // similar to the report and marketing toolkit views.
  return (
    <div className="min-h-screen bg-white w-full relative">
      <div className="fixed top-4 left-4 z-50">
        <Button
          variant="default"
          onClick={() => router.push("/dashboard")}
          className="bg-white hover:bg-gray-50 text-gray-900 shadow-lg border border-gray-200"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
      {landingPage.isPublished && (
        <div className="fixed top-4 right-4 z-50">
          <Button
            variant="outline"
            onClick={() => window.open(`/landing/${landingPage.slug}`, "_blank")}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View Live Page
          </Button>
        </div>
      )}
      <iframe
        title={landingPage.title || "Landing Page"}
        srcDoc={landingPage.htmlContent || ""}
        sandbox="allow-scripts allow-same-origin"
        className="w-full h-screen border-0 bg-white"
      />
    </div>
  );
}

