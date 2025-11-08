"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Plus, RefreshCw, Users } from "lucide-react";
import { ManuscriptCard } from "@/components/manuscript-card";
import { CondensedLibrary } from "@/components/condensed-library";

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
    status: "requested" | "analyzing" | "completed";
    requestedAt: string;
    completedAt?: string;
  };
  digestJob?: {
    status: string;
    words?: number;
    summary?: string;
    coverUrl?: string;
  } | null;
}

export default function Dashboard() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    } else if (session) {
      fetchBooks();
      checkProcessingJobs();
    }
  }, [session, isPending]);

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


  if (isPending || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  // Calculate statistics for welcome message
  const calculateStats = () => {
    let unlockedInsights = 0;
    const totalInsights = 5; // 5 features per book
    
    books.forEach((book) => {
      const hasSummary = (book.digestJob?.summary && book.digestJob.status === "completed") || 
                         (book.latestVersion?.summary !== undefined && book.latestVersion.summary !== null);
      const hasReport = book.latestReport?.status === "completed";
      
      if (hasSummary) unlockedInsights++;
      if (hasReport) unlockedInsights++;
    });
    
    return {
      unlockedInsights,
      totalInsights: books.length * totalInsights,
      activeManuscripts: books.length,
    };
  };

  const stats = calculateStats();
  const userName = session?.user?.name?.split(' ')[0] || session?.user?.email?.split('@')[0] || 'Author';

  // Map book data to condensed library format
  const mapBookToCondensed = (book: Book) => {
    const hasSummary = (book.digestJob?.summary && book.digestJob.status === "completed") || 
                       (book.latestVersion?.summary !== undefined && book.latestVersion.summary !== null);
    const hasReport = book.latestReport?.status === "completed";
    
    const steps = [
      { id: "summary", status: hasSummary ? ("complete" as const) : ("locked" as const) },
      { id: "manuscript-report", status: hasReport ? ("complete" as const) : ("locked" as const) },
      { id: "marketing-assets", status: "locked" as const },
      { id: "book-covers", status: "locked" as const },
      { id: "landing-page", status: "locked" as const },
    ];

    const coverImage = book.digestJob?.coverUrl || book.coverImageUrl || "/placeholder.svg";
    const genre = "FICTION / Romance / Contemporary"; // Default genre

    return {
      id: book.id,
      title: book.title,
      coverImage,
      genre,
      steps,
    };
  };

  // Map book data to ManuscriptCard format
  const mapBookToManuscriptCard = (book: Book) => {
    // Determine feature statuses - check digest job summary first, then book version summary
    const hasSummary = (book.digestJob?.summary && book.digestJob.status === "completed") || 
                       (book.latestVersion?.summary !== undefined && book.latestVersion.summary !== null);
    const hasReport = book.latestReport?.status === "completed";
    
    const steps = [
      {
        id: "summary",
        title: "Free Summary",
        status: hasSummary ? ("complete" as const) : ("locked" as const),
        action: "View a basic summary of your manuscript.",
        price: "Free",
        buttonText: hasSummary ? "View Summary" : "Unlock",
      },
      {
        id: "manuscript-report",
        title: "Manuscript Report",
        status: hasReport ? ("complete" as const) : ("locked" as const),
        action: "View a comprehensive review and marketing report.",
        price: hasReport ? "Unlocked" : "$149.99",
        buttonText: hasReport ? "View Report" : "Unlock",
      },
      {
        id: "marketing-assets",
        title: "Marketing Assets",
        status: "locked" as const,
        action: "Video assets to advertise your book to your audience.",
        price: "$149.99",
        buttonText: "Unlock",
      },
      {
        id: "book-covers",
        title: "Book Covers",
        status: "locked" as const,
        action: "Access book covers that appeal to your core audience.",
        price: "$149.99",
        buttonText: "Unlock",
      },
      {
        id: "landing-page",
        title: "Landing Page",
        status: "locked" as const,
        action: "Access a landing page for your book that converts.",
        price: "$149.99",
        buttonText: "Unlock",
      },
    ];

    // Use digest job word count if available, otherwise estimate from file size
    const wordCount = book.digestJob?.words 
      ? `${book.digestJob.words.toLocaleString()} words`
      : book.latestVersion?.fileSize 
        ? `${Math.round((book.latestVersion.fileSize / 1024) * 500).toLocaleString()} words`
        : "Unknown word count";

    // Use digest job cover URL if available, otherwise use book coverImageUrl
    const coverImage = book.digestJob?.coverUrl || book.coverImageUrl || "/placeholder.svg";

    return {
      id: book.id,
      title: book.title,
      subtitle: book.description || "A manuscript awaiting analysis",
      wordCount,
      genre: "FICTION", // Default genre, could be enhanced with actual genre data
      steps,
      coverImage,
    };
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        {books.length > 0 && (
          <>
            <div className="mb-6 md:mb-8 premium-card rounded-2xl p-4 md:p-8">
              <h2 className="text-lg md:text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight mb-2">
                Welcome back, {userName}!
              </h2>
              <p className="text-sm md:text-base text-gray-600 font-medium">
                You've unlocked <b>{stats.unlockedInsights} of {stats.totalInsights} manuscript insights</b> and have <b>{stats.activeManuscripts} active manuscript{stats.activeManuscripts !== 1 ? 's' : ''}</b>.
              </p>
              <p className="text-sm md:text-base text-gray-600 font-medium">
                Ready for your next step? Unlock your Author Data Reports to target your audience better.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col md:flex-row justify-center gap-4 mb-6 md:mb-8">
              <Link href="/dashboard/new-book" className="w-full md:w-auto">
                <button className="w-full md:w-auto btn-premium-emerald text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <RefreshCw className="w-4 h-4 inline-block align-middle" />
                  Analyze Another Manuscript
                </button>
              </Link>
              <button className="w-full md:w-auto btn-premium-sapphire text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-sapphire-500">
                <Users className="w-4 h-4 inline-block align-middle" />
                Refer an Author
              </button>
            </div>

            {/* Condensed Library */}
            <div className="mb-6 md:mb-8">
              <CondensedLibrary 
                manuscripts={books.map(mapBookToCondensed)}
              />
            </div>
          </>
        )}

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
          <div className="space-y-6">
            {books.map((book) => (
              <div key={book.id} id={`detail-${book.id}`}>
                <ManuscriptCard
                  {...mapBookToManuscriptCard(book)}
                />
              </div>
            ))}
          </div>
        )}
    </main>
  );
}