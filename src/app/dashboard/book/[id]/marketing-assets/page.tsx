"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MarketingAsset {
  id: string;
  assetType: string;
  title: string;
  description: string;
  fileUrl: string;
  thumbnailUrl?: string;
  status: string;
  createdAt: string;
  metadata?: string | null;
}

export default function MarketingAssetsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const bookId = params.id as string;
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const parseMetadata = (value?: string | null) => {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    } else if (session) {
      fetchAssets();
    }
  }, [session, isPending, bookId]);

  const fetchAssets = async () => {
    try {
      const response = await fetch(`/api/books/${bookId}/marketing-assets`);
      if (response.ok) {
        const data = await response.json();
        setAssets(data);
      } else if (response.status === 403) {
        // Feature not unlocked, redirect back
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Failed to fetch marketing assets:", error);
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

  // Find the HTML-based marketing toolkit asset
  const htmlAsset = assets.find((asset) => {
    const metadata = parseMetadata(asset.metadata);
    return metadata?.variant === "html" && metadata?.htmlContent;
  });

  // If no marketing HTML exists, just show a very simple message without extra chrome
  if (!htmlAsset) {
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
            Marketing toolkit is not available yet for this book.
          </p>
        </div>
      </div>
    );
  }

  const htmlMetadata = parseMetadata(htmlAsset.metadata);

  // Render just the HTML (with videos) in a full-screen iframe, similar to report view
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
      <iframe
        title={htmlAsset.title || "Marketing Toolkit"}
        srcDoc={htmlMetadata?.htmlContent || ""}
        sandbox="allow-scripts allow-same-origin"
        className="w-full h-screen border-0 bg-white"
      />
    </div>
  );
}

