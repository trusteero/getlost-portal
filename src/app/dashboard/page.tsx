"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Plus, FileText, Clock, CheckCircle, Image } from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";

interface Book {
  id: string;
  title: string;
  personalNotes: string;
  coverImageUrl?: string;
  createdAt: string;
  latestVersion?: {
    id: string;
    fileName: string;
    uploadedAt: string;
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
    }
  }, [status]);

  const fetchBooks = async () => {
    try {
      const response = await fetch("/api/books");
      if (response.ok) {
        const data = await response.json();
        setBooks(data);
      }
    } catch (error) {
      console.error("Failed to fetch books:", error);
    } finally {
      setLoading(false);
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
    <DashboardLayout>
      {/* Main Content */}
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
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {books.map((book) => (
              <Link key={book.id} href={`/dashboard/book/${book.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full overflow-hidden">
                  <div className="flex">
                    {/* Cover Image */}
                    {book.coverImageUrl ? (
                      <div className="w-24 h-36 flex-shrink-0">
                        <img
                          src={book.coverImageUrl}
                          alt={book.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-24 h-36 flex-shrink-0 bg-gray-100 flex items-center justify-center">
                        <Image className="w-8 h-8 text-gray-400" />
                      </div>
                    )}

                    {/* Book Details */}
                    <div className="flex-1 min-w-0">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg line-clamp-1">{book.title}</CardTitle>
                        <CardDescription className="text-xs">
                          Added {new Date(book.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-2">
                        {book.personalNotes && (
                          <p className="text-xs text-gray-600 mb-2 line-clamp-2">{book.personalNotes}</p>
                        )}

                        <div className="space-y-1">
                          {book.latestVersion && (
                            <div className="flex items-center text-xs text-gray-500">
                              <FileText className="w-3 h-3 mr-1" />
                              <span className="truncate">{book.latestVersion.fileName}</span>
                            </div>
                          )}

                          {book.latestReport && (
                            <div className="flex items-center">
                              <div className="flex items-center text-xs">
                                {getStatusIcon(book.latestReport.status)}
                                <span className="ml-1">{getStatusText(book.latestReport.status)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}