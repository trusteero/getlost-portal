"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { ArrowLeft, Download, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import DashboardHeader from "@/components/dashboard-header";

interface BookCover {
  id: string;
  coverType: string;
  title: string;
  imageUrl: string;
  thumbnailUrl?: string;
  isPrimary: boolean;
  status: string;
  createdAt: string;
}

export default function BookCoversPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const bookId = params.id as string;
  const [covers, setCovers] = useState<BookCover[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookTitle, setBookTitle] = useState("");

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    } else if (session) {
      fetchCovers();
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
            Book Covers
          </h1>
          {bookTitle && (
            <p className="text-gray-600">for {bookTitle}</p>
          )}
        </div>

        {covers.length === 0 ? (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      Book Covers Coming Soon
                    </h2>
                    <p className="text-sm text-gray-600">
                      Your book covers are being designed
                    </p>
                  </div>
                </div>
                <p className="text-gray-700 mb-6">
                  Once your book covers are ready, you'll find multiple design options optimized for 
                  different formats (eBook, paperback, hardcover) and platforms. Each cover is designed 
                  to appeal to your core audience and maximize book sales.
                </p>
              </CardContent>
            </Card>

            {/* Placeholder Covers */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { type: "ebook", title: "eBook Cover", description: "Digital format optimized for online stores" },
                { type: "paperback", title: "Paperback Cover", description: "Print-ready cover with spine and back" },
                { type: "hardcover", title: "Hardcover Design", description: "Premium hardcover edition design" },
              ].map((placeholder, index) => (
                <Card key={index} className="overflow-hidden opacity-60">
                  <CardContent className="p-0">
                    <div className="aspect-[2/3] bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100 flex items-center justify-center relative">
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                        <ImageIcon className="w-16 h-16 text-gray-300 mb-4" />
                        <div className="w-full h-1 bg-gray-300 rounded mb-2"></div>
                        <div className="w-3/4 h-1 bg-gray-300 rounded mb-2"></div>
                        <div className="w-1/2 h-1 bg-gray-300 rounded"></div>
                      </div>
                      {index === 0 && (
                        <div className="absolute top-2 right-2 bg-gray-300 text-gray-600 text-xs font-semibold px-2 py-1 rounded">
                          Primary
                        </div>
                      )}
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
            {covers.map((cover) => (
              <Card key={cover.id} className="overflow-hidden">
                <CardContent className="p-0">
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
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">
                      {cover.title || `${cover.coverType} Cover`}
                    </h3>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 capitalize">
                        {cover.coverType}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => window.open(cover.imageUrl, "_blank")}
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

