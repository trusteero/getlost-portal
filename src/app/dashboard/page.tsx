"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Plus, RefreshCw, Users, Upload, X, Loader2, FileText } from "lucide-react";
import { CondensedLibrary } from "@/components/condensed-library";
import { ManuscriptCard } from "@/components/manuscript-card";

// Force dynamic rendering to prevent prerendering errors
export const dynamic = 'force-dynamic';

interface Book {
  id: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  manuscriptStatus?: "queued" | "working_on" | "ready_to_purchase";
  createdAt: string;
  isProcessing?: boolean;
  features?: Array<{
    id: string;
    featureType: string;
    status: string;
  }>;
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
  assetStatuses?: {
    report: "not_requested" | "requested" | "uploaded" | "viewed";
    marketing: "not_requested" | "requested" | "uploaded" | "viewed";
    covers: "not_requested" | "requested" | "uploaded" | "viewed";
    landingPage: "not_requested" | "requested" | "uploaded" | "viewed";
  };
  hasPrecannedContent?: boolean;
  hasPreviewReport?: boolean;
}

export default function Dashboard() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadAuthorName, setUploadAuthorName] = useState("");
  const [uploadAuthorBio, setUploadAuthorBio] = useState("");
  const [uploadCoverImage, setUploadCoverImage] = useState<File | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    } else if (session) {
      fetchBooks();
      checkProcessingJobs();
    }

    // Check for Stripe return (after successful payment)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('session_id');
      const purchaseId = params.get('purchase_id');

      if (sessionId && purchaseId) {
        // Payment was successful, refresh books
        fetchBooks();
        
        // Clean up URL
        window.history.replaceState({}, '', '/dashboard');
        
        // Show success message (you can add a toast notification here)
        console.log('Payment successful! Feature unlocked.');
      }
    }

    // Listen for upload modal open event from condensed library
    const handleOpenUploadModal = () => {
      setShowUploadModal(true);
    };
    window.addEventListener('openUploadModal', handleOpenUploadModal);
    
    // Listen for refresh books event (triggered after feature unlock)
    const handleRefreshBooks = () => {
      fetchBooks();
    };
    window.addEventListener('refreshBooks', handleRefreshBooks);
    
    return () => {
      window.removeEventListener('openUploadModal', handleOpenUploadModal);
      window.removeEventListener('refreshBooks', handleRefreshBooks);
    };
  }, [session, isPending]);

  useEffect(() => {
    // Check for processing jobs or processing assets periodically
    const hasProcessing = books.some(book => {
      if (book.isProcessing) return true;
      // Check if any asset is in processing state
      if (book.assetStatuses) {
        return Object.values(book.assetStatuses).some(status => status === 'requested');
      }
      return false;
    });
    
    if (hasProcessing) {
      // Poll more frequently (every 2 seconds) when assets are processing
      // This ensures we catch the 10-second delay transition quickly
      const interval = setInterval(() => {
        fetchBooks();
        checkProcessingJobs();
      }, 2000); // Check every 2 seconds for faster updates

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

  // Upload functionality
  const supportedFormats = process.env.NEXT_PUBLIC_SUPPORTED_FORMATS || ".docx,.pdf,.epub";
  const formatList = supportedFormats.split(",").map(f => f.trim());

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = (file: File) => {
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    if (!formatList.includes(fileExtension)) {
      setUploadError(`File format not supported. Please upload: ${formatList.join(", ")}`);
      return;
    }

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      setUploadError("File size must be less than 50MB");
      return;
    }

    setUploadFile(file);
    setUploadError("");
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!uploadFile) {
      setUploadError("Please upload a manuscript file");
      return;
    }

    setUploading(true);
    setUploadError("");

    try {
      const formData = new FormData();
      // Title is optional - will use filename if not provided
      if (uploadTitle.trim()) {
        formData.append("title", uploadTitle.trim());
      }
      // Author name is optional
      if (uploadAuthorName.trim()) {
        formData.append("authorName", uploadAuthorName.trim());
      }
      // Author bio is optional
      if (uploadAuthorBio.trim()) {
        formData.append("authorBio", uploadAuthorBio.trim());
      }
      // Cover image is optional
      if (uploadCoverImage) {
        formData.append("coverImage", uploadCoverImage);
      }
      formData.append("file", uploadFile);

      const response = await fetch("/api/books", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to create book");
      }

      const data = await response.json();
      setShowUploadModal(false);
      setUploadTitle("");
      setUploadAuthorName("");
      setUploadAuthorBio("");
      setUploadCoverImage(null);
      setUploadFile(null);
      await fetchBooks();
      // Scroll to the newly uploaded book
      setTimeout(() => {
        const element = document.getElementById(`detail-${data.bookId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (error) {
      setUploadError("Failed to create book. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const closeUploadModal = () => {
    setShowUploadModal(false);
    setUploadTitle("");
    setUploadAuthorName("");
    setUploadAuthorBio("");
    setUploadCoverImage(null);
    setUploadFile(null);
    setUploadError("");
    setDragActive(false);
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
    const totalInsights = 5; // 5 features per book: summary, manuscript-report, marketing-assets, book-covers, landing-page
    
    books.forEach((book) => {
      // 1. Summary (free when digest completes or book version has summary)
      const hasSummary = (book.digestJob?.summary && book.digestJob.status === "completed") || 
                         (book.latestVersion?.summary !== undefined && book.latestVersion.summary !== null);
      if (hasSummary) unlockedInsights++;
      
      // 2. Manuscript Report (check assetStatuses or feature status)
      const hasReport = book.assetStatuses?.report === "uploaded" || 
                        book.assetStatuses?.report === "viewed" ||
                        book.latestReport?.status === "completed" ||
                        book.features?.some(f => f.featureType === "manuscript-report" && (f.status === "purchased" || f.status === "unlocked"));
      if (hasReport) unlockedInsights++;
      
      // 3. Marketing Assets
      const hasMarketing = book.assetStatuses?.marketing === "uploaded" || 
                           book.assetStatuses?.marketing === "viewed" ||
                           book.features?.some(f => f.featureType === "marketing-assets" && (f.status === "purchased" || f.status === "unlocked"));
      if (hasMarketing) unlockedInsights++;
      
      // 4. Book Covers
      const hasCovers = book.assetStatuses?.covers === "uploaded" || 
                       book.assetStatuses?.covers === "viewed" ||
                       book.features?.some(f => f.featureType === "book-covers" && (f.status === "purchased" || f.status === "unlocked"));
      if (hasCovers) unlockedInsights++;
      
      // 5. Landing Page
      const hasLandingPage = book.assetStatuses?.landingPage === "uploaded" || 
                             book.assetStatuses?.landingPage === "viewed" ||
                             book.features?.some(f => f.featureType === "landing-page" && (f.status === "purchased" || f.status === "unlocked"));
      if (hasLandingPage) unlockedInsights++;
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
    
    // Check feature unlock statuses from database
    const getFeatureStatus = (featureType: string): 'complete' | 'locked' => {
      const feature = book.features?.find(f => f.featureType === featureType);
      if (feature && feature.status !== 'locked') {
        return 'complete';
      }
      // For summary only, check if preview report exists (not just summary text)
      if (featureType === 'summary') {
        // Only show as complete if preview report exists
        if (book.hasPreviewReport) {
          return 'complete';
        }
        return 'locked';
      }
      // For manuscript-report, require explicit unlock via purchase
      return 'locked';
    };
    
    // For condensed view, use the same status (getFeatureStatus only returns 'complete' | 'locked')
    const getCondensedStatus = (featureType: string): 'complete' | 'locked' => {
      return getFeatureStatus(featureType);
    };
    
    const steps = [
      { id: "summary", status: getCondensedStatus("summary") },
      { id: "manuscript-report", status: getCondensedStatus("manuscript-report") },
      { id: "marketing-assets", status: getCondensedStatus("marketing-assets") },
      { id: "book-covers", status: getCondensedStatus("book-covers") },
      { id: "landing-page", status: getCondensedStatus("landing-page") },
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
    // Get manuscript status
    const manuscriptStatus = book.manuscriptStatus || "queued";
    const isManuscriptReady = manuscriptStatus === "ready_to_purchase";
    const hasViewedReport = book.assetStatuses?.report === "viewed";
    
    // Determine feature statuses - check digest job summary first, then book version summary
    const hasSummary = (book.digestJob?.summary && book.digestJob.status === "completed") || 
                       (book.latestVersion?.summary !== undefined && book.latestVersion.summary !== null);
    const hasReport = book.latestReport?.status === "completed";
    
    // Check feature unlock statuses from database
    const getFeatureStatus = (featureType: string): 'complete' | 'locked' | 'processing' => {
      // For manuscript-report, use manuscriptStatus
      if (featureType === 'manuscript-report') {
        if (manuscriptStatus === "queued") {
          return 'processing'; // Show as processing with "Queued" text
        } else if (manuscriptStatus === "working_on") {
          return 'processing'; // Show as processing with "Working on Report" text
        } else if (manuscriptStatus === "ready_to_purchase") {
          // Check if report is actually uploaded
          if (book.assetStatuses?.report === 'uploaded' || book.assetStatuses?.report === 'viewed') {
            return 'complete';
          }
          // Ready to purchase but not uploaded yet
          return 'locked';
        }
        return 'locked';
      }
      
      // For all other features, dim them until manuscript is ready
      if (!isManuscriptReady) {
        return 'locked';
      }
      
      // For summary only, check if preview report exists (not just summary text)
      if (featureType === 'summary') {
        // Only show as complete if preview report exists
        if (book.hasPreviewReport) {
          return 'complete';
        }
        return 'locked';
      }
      
      // For marketing, covers, and landing pages: keep dimmed until user has viewed the report
      if (featureType === 'marketing-assets' || featureType === 'book-covers' || featureType === 'landing-page') {
        if (!hasViewedReport) {
          return 'locked';
        }
      }
      
      // Check asset statuses from API
      if (book.assetStatuses) {
        let status: "not_requested" | "requested" | "uploaded" | "viewed" | undefined;
        if (featureType === 'marketing-assets') {
          status = book.assetStatuses.marketing;
        } else if (featureType === 'book-covers') {
          status = book.assetStatuses.covers;
        } else if (featureType === 'landing-page') {
          status = book.assetStatuses.landingPage;
        }
        
        if (status === 'requested') {
          return 'processing';
        } else if (status === 'uploaded' || status === 'viewed') {
          return 'complete';
        }
      }
      
      // Fallback to feature status from database
      const feature = book.features?.find(f => f.featureType === featureType);
      if (feature && feature.status !== 'locked') {
        // If feature is purchased/requested but no asset uploaded yet, show processing
        if (feature.status === 'purchased' || feature.status === 'requested') {
          return 'processing';
        }
        return 'complete';
      }
      
      return 'locked';
    };
    
    const getButtonText = (featureType: string, status: 'complete' | 'locked' | 'processing'): string => {
      // Special handling for manuscript-report based on status
      if (featureType === 'manuscript-report') {
        if (manuscriptStatus === "queued") {
          return 'Queued';
        } else if (manuscriptStatus === "working_on") {
          return 'Working on Report';
        } else if (manuscriptStatus === "ready_to_purchase") {
          if (status === 'complete') {
            return 'View Report';
          }
          return 'Purchase';
        }
      }
      
      if (status === 'processing') {
        return 'Processing...';
      }
      if (status === 'complete') {
        if (featureType === 'summary') return 'View Summary';
        return 'View';
      }
      // For summary, don't show unlock button - keep it dimmed
      if (featureType === 'summary') {
        return ''; // Empty string means no button will be shown
      }
      return 'Unlock';
    };
    
    const steps = [
      {
        id: "summary",
        title: "Free Summary",
        status: getFeatureStatus("summary"),
        action: "View a basic summary of your manuscript.",
        price: "Free",
        buttonText: getButtonText("summary", getFeatureStatus("summary")),
      },
      {
        id: "manuscript-report",
        title: "Manuscript Report",
        status: getFeatureStatus("manuscript-report"),
        action: "View a comprehensive review and marketing report.",
        price: getFeatureStatus("manuscript-report") === 'complete' ? "Unlocked" : "$149.99",
        buttonText: getButtonText("manuscript-report", getFeatureStatus("manuscript-report")),
      },
      {
        id: "marketing-assets",
        title: "Marketing Assets",
        status: getFeatureStatus("marketing-assets"),
        action: "Video assets to advertise your book to your audience.",
        price: getFeatureStatus("marketing-assets") === 'complete' ? "Unlocked" : "$149.99",
        buttonText: getButtonText("marketing-assets", getFeatureStatus("marketing-assets")),
      },
      {
        id: "book-covers",
        title: "Book Covers",
        status: getFeatureStatus("book-covers"),
        action: "Access book covers that appeal to your core audience.",
        price: getFeatureStatus("book-covers") === 'complete' ? "Unlocked" : "$149.99",
        buttonText: getButtonText("book-covers", getFeatureStatus("book-covers")),
      },
      {
        id: "landing-page",
        title: "Landing Page",
        status: getFeatureStatus("landing-page"),
        action: "Access a landing page for your book that converts.",
        price: getFeatureStatus("landing-page") === 'complete' ? "Unlocked" : "$149.99",
        buttonText: getButtonText("landing-page", getFeatureStatus("landing-page")),
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
      hasPrecannedContent: book.hasPrecannedContent || false,
      manuscriptStatus: manuscriptStatus as "queued" | "working_on" | "ready_to_purchase",
      hasViewedReport,
    };
  };


  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-6 md:mb-8 premium-card rounded-2xl p-4 md:p-8">
          <h2 className="text-lg md:text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight mb-2">
            {books.length === 0 ? `Welcome, ${userName}!` : `Welcome back, ${userName}!`}
          </h2>
          {books.length > 0 ? (
            <>
              <p className="text-sm md:text-base text-gray-600 font-medium">
                You've unlocked <b>{stats.unlockedInsights} of {stats.totalInsights} manuscript insights</b> and have <b>{stats.activeManuscripts} active manuscript{stats.activeManuscripts !== 1 ? 's' : ''}</b>.
              </p>
              <p className="text-sm md:text-base text-gray-600 font-medium">
                Ready for your next step? Unlock your Author Data Reports to target your audience better.
              </p>
            </>
          ) : (
            <p className="text-sm md:text-base text-gray-600 font-medium">
              Get started by uploading your first manuscript to begin your journey.
            </p>
          )}
        </div>

        {books.length > 0 && (
          <>

            {/* Action Buttons */}
            <div className="flex flex-col md:flex-row justify-center gap-4 mb-6 md:mb-8">
              <button 
                onClick={() => setShowUploadModal(true)}
                className="w-full md:w-auto btn-premium-emerald text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <RefreshCw className="w-4 h-4 inline-block align-middle" />
                Analyze Another Manuscript
              </button>
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

            {/* Individual Book Cards */}
            <div className="space-y-6">
              {books.map((book) => (
                <div key={book.id} id={`detail-${book.id}`}>
                  <ManuscriptCard
                    {...mapBookToManuscriptCard(book)}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {books.length === 0 && (
          <Card className="text-center py-16">
            <CardContent>
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">No books yet</h2>
              <p className="text-gray-600 mb-6">Upload your first manuscript to get started</p>
              <Button 
                onClick={() => setShowUploadModal(true)}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Book
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Upload Manuscript</h2>
                  <button
                    onClick={closeUploadModal}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    disabled={uploading}
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <form onSubmit={handleUploadSubmit} className="space-y-6">
                  <div>
                    <Label htmlFor="title">Book Title <span className="text-gray-400 font-normal">(optional)</span></Label>
                    <Input
                      id="title"
                      type="text"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="Enter your book title (will use filename if not provided)"
                      className="mt-1"
                      disabled={uploading}
                    />
                  </div>

                  <div>
                    <Label htmlFor="authorName">Author Name <span className="text-gray-400 font-normal">(optional)</span></Label>
                    <Input
                      id="authorName"
                      type="text"
                      value={uploadAuthorName}
                      onChange={(e) => setUploadAuthorName(e.target.value)}
                      placeholder="Enter author name"
                      className="mt-1"
                      disabled={uploading}
                    />
                  </div>

                  <div>
                    <Label htmlFor="authorBio">Author Bio <span className="text-gray-400 font-normal">(optional)</span></Label>
                    <textarea
                      id="authorBio"
                      value={uploadAuthorBio}
                      onChange={(e) => setUploadAuthorBio(e.target.value)}
                      placeholder="Enter author biography"
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      rows={3}
                      disabled={uploading}
                    />
                  </div>

                  <div>
                    <Label htmlFor="coverImage">Cover Image <span className="text-gray-400 font-normal">(optional)</span></Label>
                    <Input
                      id="coverImage"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setUploadCoverImage(e.target.files[0]);
                        }
                      }}
                      className="mt-1"
                      disabled={uploading}
                    />
                    {uploadCoverImage && (
                      <p className="mt-1 text-sm text-gray-600">
                        Selected: {uploadCoverImage.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Manuscript File</Label>
                    <div
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      className={`mt-1 border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                        dragActive
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-gray-300 hover:border-gray-400"
                      } ${uploading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <input
                        type="file"
                        id="file-upload"
                        name="file-upload"
                        accept={formatList.join(",")}
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleFileSelect(e.target.files[0]);
                          }
                        }}
                        className="hidden"
                        disabled={uploading}
                      />
                      {uploadFile ? (
                        <div className="space-y-2">
                          <FileText className="mx-auto h-12 w-12 text-emerald-600" />
                          <p className="text-sm font-medium text-gray-900">{uploadFile.name}</p>
                          <p className="text-xs text-gray-500">
                            {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                          {!uploading && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setUploadFile(null)}
                              className="mt-2"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      ) : (
                        <label htmlFor="file-upload" className="cursor-pointer">
                          <Upload className="mx-auto h-12 w-12 text-gray-400" />
                          <p className="mt-2 text-sm text-gray-600">
                            <span className="font-medium text-emerald-600">Click to upload</span> or drag and drop
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {formatList.join(", ").toUpperCase()} (max 50MB)
                          </p>
                        </label>
                      )}
                    </div>
                  </div>

                  {uploadError && (
                    <div className="bg-red-50 text-red-800 p-3 rounded-md text-sm">
                      {uploadError}
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeUploadModal}
                      disabled={uploading}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      disabled={uploading || !uploadTitle.trim() || !uploadFile}
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Manuscript
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
    </main>
  );
}