"use client";

import { useParams } from "next/navigation";

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
    <div className="w-full h-screen bg-white">
      <iframe
        title="Marketing Toolkit"
        src={`/api/books/${bookId}/marketing-assets/view`}
        className="w-full h-full border-0 bg-white"
        style={{ 
          width: '100%', 
          height: '100vh'
        }}
      />
    </div>
  );
}

