"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Plus, FileText, Clock, CheckCircle, Image } from "lucide-react";

interface Book {
  id: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  createdAt: string;
  isProcessing?: boolean;
  latestVersion?: {
    id: string;
    fileName: string;
    uploadedAt: string;
    fileSize: number;
    summary?: string;
  };
  latestReport?: {
    id: string;
    status: "pending" | "analyzing" | "completed";
    requestedAt: string;
    completedAt?: string;
  };
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchBooks();
      checkProcessingJobs();
    }
  }, [status]);

  useEffect(() => {
    // Check for processing jobs periodically
    const hasProcessing = books.some(book => book.isProcessing);
    if (hasProcessing) {
      const interval = setInterval(() => {
        fetchBooks();
        checkProcessingJobs();
      }, 10000); // Check every 10 seconds

      return () => clearInterval(interval);
    }
  }, [books]);

  const fetchBooks = async () => {
    try {
      const response = await fetch("/api/books");
      if (response.ok) {
        const data = await response.json();
        setBooks(data);
      } else if (response.status === 401) {
        // Session is invalid, clear cookies and redirect to login
        await fetch("/api/auth/clear-session", { method: "POST" });
        router.push("/login");
      }
    } catch (error) {
      console.error("Failed to fetch books:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkProcessingJobs = async () => {
    try {
      const response = await fetch("/api/digest/check-jobs", { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        // If any jobs were updated to completed, refresh the books
        if (data.updated && data.updated.some((job: any) => job.status === "completed" || job.status === "failed")) {
          await fetchBooks();
        }
      }
    } catch (error) {
      console.error("Failed to check processing jobs:", error);
    }
  };


  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case "analyzing":
        return <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      default:
        return null;
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case "pending":
        return "Waiting for analysis";
      case "analyzing":
        return "Being analyzed";
      case "completed":
        return "Report ready";
      default:
        return "No analysis requested";
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Your Books</h1>
          <Link href="/dashboard/new-book">
            <Button className="bg-orange-600 hover:bg-orange-700">
              <Plus className="w-4 h-4 mr-2" />
              Add New Book
            </Button>
          </Link>
        </div>

        {books.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">No books yet</h2>
              <p className="text-gray-600 mb-6">Upload your first manuscript to get started</p>
              <Link href="/dashboard/new-book">
                <Button className="bg-orange-600 hover:bg-orange-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Book
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {books.map((book) => (
              <Link key={book.id} href={`/dashboard/book/${book.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full overflow-hidden">
                  <div className="flex p-4">
                    {/* Cover Image */}
                    {book.coverImageUrl ? (
                      <div className="w-20 h-[120px] flex-shrink-0 mr-4 sm:mr-6 relative">
                        <div className="absolute inset-0 bg-gray-500" style={{ transform: 'translate(4px, 4px)' }}></div>
                        <div className="absolute inset-0 bg-gray-400" style={{ transform: 'translate(3px, 3px)' }}></div>
                        <div className="absolute inset-0 bg-gray-300" style={{ transform: 'translate(2px, 2px)' }}></div>
                        <div className="absolute inset-0 bg-gray-200" style={{ transform: 'translate(1px, 1px)' }}></div>
                        <img
                          src={book.coverImageUrl}
                          alt={book.title}
                          className="relative w-full h-full object-cover border border-gray-200"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-[120px] flex-shrink-0 mr-4 sm:mr-6 relative">
                        <div className="absolute inset-0 bg-gray-500" style={{ transform: 'translate(4px, 4px)' }}></div>
                        <div className="absolute inset-0 bg-gray-400" style={{ transform: 'translate(3px, 3px)' }}></div>
                        <div className="absolute inset-0 bg-gray-300" style={{ transform: 'translate(2px, 2px)' }}></div>
                        <div className="absolute inset-0 bg-gray-200" style={{ transform: 'translate(1px, 1px)' }}></div>
                        <div className="relative w-full h-full bg-gray-100 flex items-center justify-center border border-gray-200">
                          <Image className="w-6 h-6 text-gray-400" />
                        </div>
                      </div>
                    )}

                    {/* Book Details */}
                    <div className="flex-1 min-w-0 text-left flex flex-col">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold line-clamp-2 sm:line-clamp-1">{book.title}</h3>

                        {book.description && (
                          <p className="text-xs text-gray-600 line-clamp-2 mt-2">{book.description}</p>
                        )}

                        {book.isProcessing && (
                          <div className="flex items-center mt-2">
                            <div className="flex items-center text-xs">
                              <div className="w-3 h-3 mr-1 border border-orange-600 border-t-transparent rounded-full animate-spin" />
                              <span className="text-orange-600">Processing</span>
                            </div>
                          </div>
                        )}

                        {!book.isProcessing && book.latestReport && (
                          <div className="flex items-center mt-2">
                            <div className="flex items-center text-xs">
                              {getStatusIcon(book.latestReport.status)}
                              <span className="ml-1">{getStatusText(book.latestReport.status)}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 mt-auto pt-2">
                        Added {new Date(book.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
    </main>
  );
}