"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// Force dynamic rendering to prevent prerendering errors
export const dynamic = 'force-dynamic';

export default function MarketingAssetsPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  // Render the HTML (with videos) in a full-screen iframe
  // The API route handles authentication and returns the HTML directly
  // If the feature isn't unlocked or asset doesn't exist, the API will return an error
  // which the iframe will handle gracefully
  return (
    <div className="min-h-screen bg-white w-full relative overflow-hidden">
      <div className="fixed top-2 left-2 sm:top-4 sm:left-4 z-50">
        <Button
          variant="default"
          onClick={() => router.push("/dashboard")}
          className="bg-white hover:bg-gray-50 text-gray-900 shadow-lg border border-gray-200 text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2"
          size="sm"
        >
          <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Back to Dashboard</span>
          <span className="sm:hidden">Back</span>
        </Button>
      </div>
      <div className="w-full h-screen pt-10 sm:pt-0">
        <iframe
          title="Marketing Toolkit"
          src={`/api/books/${bookId}/marketing-assets/view`}
          className="w-full h-full border-0 bg-white"
          style={{ 
            width: '100%', 
            height: '100%',
            minHeight: 'calc(100vh - 2.5rem)'
          }}
        />
      </div>
    </div>
  );
}

