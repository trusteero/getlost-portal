"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { ArrowLeft, ExternalLink, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import DashboardHeader from "@/components/dashboard-header";

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
  const [bookTitle, setBookTitle] = useState("");

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    } else if (session) {
      fetchLandingPage();
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
            Landing Page
          </h1>
          {bookTitle && (
            <p className="text-gray-600">for {bookTitle}</p>
          )}
        </div>

        {!landingPage ? (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Globe className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      Landing Page Coming Soon
                    </h2>
                    <p className="text-sm text-gray-600">
                      Your landing page is being created
                    </p>
                  </div>
                </div>
                <p className="text-gray-700 mb-6">
                  Once your landing page is ready, you'll have a fully optimized, conversion-focused 
                  page designed to turn visitors into readers. The landing page will include compelling 
                  copy, social proof, and clear calls-to-action to maximize book sales.
                </p>
              </CardContent>
            </Card>

            {/* Placeholder Landing Page Preview */}
            <Card>
              <CardContent className="p-0">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-8 md:p-12">
                  {/* Hero Section Placeholder */}
                  <div className="max-w-4xl mx-auto text-center mb-8">
                    <div className="h-8 w-64 bg-gray-300 rounded mx-auto mb-4 animate-pulse"></div>
                    <div className="h-4 w-96 bg-gray-200 rounded mx-auto mb-6 animate-pulse"></div>
                    <div className="h-12 w-48 bg-gray-300 rounded mx-auto animate-pulse"></div>
                  </div>

                  {/* Content Sections Placeholder */}
                  <div className="max-w-4xl mx-auto space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="bg-white rounded-lg p-6 shadow-sm">
                        <div className="h-6 w-3/4 bg-gray-200 rounded mb-4 animate-pulse"></div>
                        <div className="space-y-2">
                          <div className="h-3 w-full bg-gray-100 rounded animate-pulse"></div>
                          <div className="h-3 w-5/6 bg-gray-100 rounded animate-pulse"></div>
                          <div className="h-3 w-4/6 bg-gray-100 rounded animate-pulse"></div>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-6 shadow-sm">
                        <div className="h-6 w-3/4 bg-gray-200 rounded mb-4 animate-pulse"></div>
                        <div className="space-y-2">
                          <div className="h-3 w-full bg-gray-100 rounded animate-pulse"></div>
                          <div className="h-3 w-5/6 bg-gray-100 rounded animate-pulse"></div>
                          <div className="h-3 w-4/6 bg-gray-100 rounded animate-pulse"></div>
                        </div>
                      </div>
                    </div>

                    {/* CTA Section Placeholder */}
                    <div className="bg-white rounded-lg p-8 text-center shadow-sm">
                      <div className="h-6 w-2/3 bg-gray-200 rounded mx-auto mb-4 animate-pulse"></div>
                      <div className="h-10 w-40 bg-gray-300 rounded mx-auto animate-pulse"></div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        Preview Mode
                      </p>
                      <p className="text-xs text-gray-500">
                        Your actual landing page will be fully functional and optimized for conversions
                      </p>
                    </div>
                    <Button variant="outline" disabled>
                      <Globe className="w-4 h-4 mr-2" />
                      Coming Soon
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      {landingPage.headline || landingPage.title}
                    </h2>
                    {landingPage.subheadline && (
                      <p className="text-lg text-gray-600 mb-4">
                        {landingPage.subheadline}
                      </p>
                    )}
                  </div>
                  {landingPage.isPublished && (
                    <Button
                      onClick={() => window.open(`/landing/${landingPage.slug}`, "_blank")}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Live Page
                    </Button>
                  )}
                </div>
                {landingPage.description && (
                  <div className="prose max-w-none">
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {landingPage.description}
                    </p>
                  </div>
                )}
                {landingPage.htmlContent && (
                  <div className="mt-6 border-t pt-6">
                    <div
                      dangerouslySetInnerHTML={{ __html: landingPage.htmlContent }}
                      className="prose max-w-none"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

