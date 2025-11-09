"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { ArrowLeft, Download, Video, Image as ImageIcon, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import DashboardHeader from "@/components/dashboard-header";

interface MarketingAsset {
  id: string;
  assetType: string;
  title: string;
  description: string;
  fileUrl: string;
  thumbnailUrl?: string;
  status: string;
  createdAt: string;
}

export default function MarketingAssetsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const bookId = params.id as string;
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookTitle, setBookTitle] = useState("");

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    } else if (session) {
      fetchAssets();
      fetchBookTitle();
    }
  }, [session, isPending, bookId]);

  const fetchBookTitle = async () => {
    try {
      const response = await fetch(`/api/books/${bookId}`);
      if (response.ok) {
        const book = await response.json();
        setBookTitle(book.title);
      }
    } catch (error) {
      console.error("Failed to fetch book title:", error);
    }
  };

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

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Marketing Assets
          </h1>
          {bookTitle && (
            <p className="text-gray-600">for {bookTitle}</p>
          )}
        </div>

        {assets.length === 0 ? (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Video className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      Marketing Assets Coming Soon
                    </h2>
                    <p className="text-sm text-gray-600">
                      Your marketing assets are being generated
                    </p>
                  </div>
                </div>
                <p className="text-gray-700 mb-6">
                  Once your marketing assets are ready, you'll find video content, social media posts, 
                  banners, and other promotional materials here. These assets are designed to help you 
                  effectively market your book to your target audience.
                </p>
              </CardContent>
            </Card>

            {/* Placeholder Assets */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { type: "video", title: "Book Trailer", description: "60-second promotional video" },
                { type: "social-post", title: "Instagram Post", description: "Square format social media post" },
                { type: "banner", title: "Website Banner", description: "Header banner for your website" },
              ].map((placeholder, index) => (
                <Card key={index} className="overflow-hidden opacity-60">
                  <CardContent className="p-0">
                    <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <Video className="w-12 h-12 text-gray-400" />
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                        <h3 className="font-semibold text-gray-700">
                          {placeholder.title}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-500 mb-4">
                        {placeholder.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 capitalize">
                          {placeholder.type}
                        </span>
                        <Button size="sm" variant="outline" disabled>
                          <Download className="w-4 h-4 mr-2" />
                          Coming Soon
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assets.map((asset) => (
              <Card key={asset.id} className="overflow-hidden">
                <CardContent className="p-0">
                  {asset.thumbnailUrl ? (
                    <div className="aspect-video bg-gray-100 relative">
                      <img
                        src={asset.thumbnailUrl}
                        alt={asset.title || "Marketing asset"}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gray-100 flex items-center justify-center">
                      <Video className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">
                      {asset.title || `${asset.assetType} Asset`}
                    </h3>
                    {asset.description && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {asset.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 capitalize">
                        {asset.assetType}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => window.open(asset.fileUrl, "_blank")}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

