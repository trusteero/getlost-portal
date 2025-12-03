 "use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BookCover {
  id: string;
  coverType: string;
  title: string;
  imageUrl: string;
  thumbnailUrl?: string;
  isPrimary: boolean;
  status: string;
  createdAt: string;
  metadata?: string | null;
}

export default function BookCoversPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const bookId = params.id as string;
  const [covers, setCovers] = useState<BookCover[]>([]);
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
      fetchCovers();
    }
  }, [session, isPending, bookId]);

  const fetchCovers = async () => {
    try {
      const response = await fetch(`/api/books/${bookId}/covers`);
      if (response.ok) {
        const data = await response.json();
        setCovers(data);
      } else if (response.status === 403) {
        // Feature not unlocked, redirect back
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Failed to fetch book covers:", error);
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

  // If there are no covers yet, show a minimal placeholder and back button.
  if (covers.length === 0) {
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
            Book covers are not available yet for this book.
          </p>
        </div>
      </div>
    );
  }

  // If we have an HTML-based cover gallery, show it full-screen like the report/marketing views.
  const htmlCover = covers.find((cover) => {
    const metadata = parseMetadata(cover.metadata);
    return metadata?.variant === "html" && metadata?.htmlContent;
  });

  if (htmlCover) {
    const metadata = parseMetadata(htmlCover.metadata);
    return (
      <div className="w-full h-screen bg-white">
        <iframe
          title={htmlCover.title || "Cover Gallery"}
          srcDoc={metadata?.htmlContent || ""}
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

  // Otherwise, show a simple grid of the static cover images with minimal chrome.
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
      <div className="flex-1 px-4 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {covers.map((cover) => (
            <div key={cover.id} className="overflow-hidden rounded-lg border bg-white shadow-sm">
              <div className="aspect-[2/3] bg-gray-100 relative">
                <img
                  src={cover.imageUrl}
                  alt={cover.title || `${cover.coverType} cover`}
                  className="w-full h-full object-cover"
                />
                {cover.isPrimary && (
                  <div className="absolute top-2 right-2 bg-emerald-500 text-white text-xs font-semibold px-2 py-1 rounded">
                    Primary
                  </div>
                )}
              </div>
              <div className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {cover.title || `${cover.coverType} Cover`}
                  </h3>
                  <span className="text-xs text-gray-500 capitalize">
                    {cover.coverType}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(cover.imageUrl, "_blank")}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

