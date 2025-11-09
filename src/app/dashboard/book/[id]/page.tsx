"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft, Upload, FileText, Clock, CheckCircle, AlertCircle,
  Download, Eye, CreditCard, Loader2, ChevronDown, ChevronRight, Edit2, Save, X, Image,
  Lock, Users, Megaphone, BookOpen, MessageCircle
} from "lucide-react";

interface BookVersion {
  id: string;
  versionNumber: number;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadedAt: string;
  summary?: string;
  reports: Report[];
}

interface Report {
  id: string;
  status: "pending" | "requested" | "analyzing" | "completed";
  requestedAt: string;
  completedAt?: string;
  htmlContent?: string;
  pdfUrl?: string;
}

interface Book {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  createdAt: string;
  versions: BookVersion[];
}

interface DigestJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed" | "no_job";
  attempts?: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  title?: string;
  author?: string;
  pages?: number;
  words?: number;
  language?: string;
  brief?: string;
  shortSummary?: string;
  summary?: string;
  coverUrl?: string;
}

export default function BookDetail() {
  const params = useParams();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [uploadingNewVersion, setUploadingNewVersion] = useState(false);
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<BookVersion | null>(null);
  const [activeTab, setActiveTab] = useState<string>("summary");
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [newCoverImage, setNewCoverImage] = useState<File | null>(null);
  const [newCoverImagePreview, setNewCoverImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [digestJob, setDigestJob] = useState<DigestJob | null>(null);
  const [digestLoaded, setDigestLoaded] = useState(false);
  const [checkingDigest, setCheckingDigest] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const [isViewingReport, setIsViewingReport] = useState(false);
  const reportContainerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Set mounted flag after component mounts (client-side only)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Execute scripts in report HTML after rendering
  useEffect(() => {
    if (isViewingReport && reportContainerRef.current && book) {
      const reportHtml = book.versions[0]?.reports?.find((r: Report) => r.status === "completed")?.htmlContent;
      if (!reportHtml) return;
      
      // Extract and execute scripts from the HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(reportHtml, 'text/html');
      const scripts = doc.querySelectorAll('script');
      
      scripts.forEach((oldScript) => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach((attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });
        newScript.textContent = oldScript.textContent;
        reportContainerRef.current?.appendChild(newScript);
      });
    }
  }, [isViewingReport, book]);

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    } else if (session) {
      fetchBook();
      fetchDigestStatus();
    }

    // Check URL hash to open specific tab or view report only
    if (typeof window !== 'undefined') {
      if (window.location.hash === '#report') {
        setIsViewingReport(true);
        setActiveTab("author");
      }
    }

    // Cleanup on unmount
    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, [session, isPending, params.id]);

  const fetchBook = async () => {
    try {
      const response = await fetch(`/api/books/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setBook(data);
        setEditedTitle(data.title);
        setEditedDescription(data.description || "");

        // Auto-expand latest version
        if (data.versions.length > 0) {
          setExpandedVersions(new Set([data.versions[0].id]));
          setSelectedVersion(data.versions[0]);

          // Auto-select latest completed report
          const latestVersion = data.versions[0];
          const completedReport = latestVersion.reports.find((r: Report) => r.status === "completed");
          if (completedReport) {
            setSelectedReport(completedReport);
          }

          // If URL has #report hash, switch to author tab and set viewing report mode
          if (typeof window !== 'undefined' && window.location.hash === '#report') {
            setIsViewingReport(true);
            setActiveTab("author");
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch book:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDigestStatus = async () => {
    try {
      const response = await fetch(`/api/books/${params.id}/digest`);
      if (response.ok) {
        const data = await response.json();
        const prevStatus = digestJob?.status;
        const isFirstLoad = !digestJob;

        console.log("Digest status check:", {
          isFirstLoad,
          prevStatus,
          newStatus: data.status,
          hasCompletedRecently: data.status === "completed" && data.completedAt &&
            (new Date().getTime() - new Date(data.completedAt).getTime()) < 30000 // completed in last 30 seconds
        });

        // Check if we should reload the page
        const shouldReload = data.status === "completed" && (
          // Case 1: We saw a transition from processing/pending to completed
          (prevStatus === "processing" || prevStatus === "pending") ||
          // Case 2: First load and it completed recently (within last 60 seconds)
          (isFirstLoad && data.completedAt &&
           (new Date().getTime() - new Date(data.completedAt).getTime()) < 60000)
        );

        if (shouldReload && !window.location.search.includes("ready=1")) {
          console.log("Processing completed! Reloading page in 3 seconds...");
          setTimeout(() => {
            window.location.href = window.location.pathname + "?ready=1";
          }, 3000);
          return;
        }

        setDigestJob(data);
        setDigestLoaded(true);

        // Keep polling if still processing or pending
        if (data.status === "processing" || data.status === "pending") {
          // Clear any existing timeout before setting a new one
          if (pollingRef.current) {
            clearTimeout(pollingRef.current);
          }
          pollingRef.current = setTimeout(() => fetchDigestStatus(), 5000); // Check every 5 seconds
        }
      } else {
        setDigestLoaded(true);
      }
    } catch (error) {
      console.error("Failed to fetch digest status:", error);
      setDigestLoaded(true);
    }
  };

  const checkDigestStatus = async () => {
    setCheckingDigest(true);
    try {
      const response = await fetch(`/api/books/${params.id}/digest/check`, {
        method: "POST",
      });
      if (response.ok) {
        await fetchDigestStatus();
      }
    } catch (error) {
      console.error("Failed to check digest status:", error);
    } finally {
      setCheckingDigest(false);
    }
  };

  const handlePurchaseAnalysis = async (versionId: string) => {
    setPurchasing(true);
    try {
      // Fake payment processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookVersionId: versionId }),
      });

      if (response.ok) {
        await fetchBook(); // Refresh to show new report
      }
    } catch (error) {
      console.error("Failed to purchase analysis:", error);
    } finally {
      setPurchasing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditedTitle(book?.title || "");
    setEditedDescription(book?.description || "");
    setNewCoverImage(null);
    setNewCoverImagePreview(null);
  };

  const handleSaveEdit = async () => {
    if (!editedTitle.trim()) return;

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("title", editedTitle);
      formData.append("description", editedDescription);
      if (newCoverImage) {
        formData.append("coverImage", newCoverImage);
      }

      const response = await fetch(`/api/books/${params.id}`, {
        method: "PATCH",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setBook(data);
        setEditMode(false);
        setNewCoverImage(null);
        setNewCoverImagePreview(null);
      }
    } catch (error) {
      console.error("Failed to update book:", error);
    } finally {
      setSaving(false);
    }
  };


  const handleCoverImageChange = (file: File) => {
    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      return;
    }

    // Check file size (max 5MB for images)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return;
    }

    setNewCoverImage(file);

    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewCoverImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadNewVersion = async () => {
    if (!newVersionFile) return;

    setUploadingNewVersion(true);
    try {
      const formData = new FormData();
      formData.append("file", newVersionFile);
      formData.append("bookId", params.id as string);

      const response = await fetch(`/api/books/${params.id}/versions`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setNewVersionFile(null);
        await fetchBook(); // Refresh to show new version
      }
    } catch (error) {
      console.error("Failed to upload new version:", error);
    } finally {
      setUploadingNewVersion(false);
    }
  };

  const toggleVersion = (versionId: string) => {
    const newExpanded = new Set(expandedVersions);
    if (newExpanded.has(versionId)) {
      newExpanded.delete(versionId);
    } else {
      newExpanded.add(versionId);
    }
    setExpandedVersions(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
      case "requested":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case "analyzing":
        return <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
      case "requested":
        return "Report requested";
      case "analyzing":
        return "Being analyzed";
      case "completed":
        return "Report ready";
      default:
        return "Unknown status";
    }
  };

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card>
          <CardContent className="p-8">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <p className="text-center text-gray-600">Book not found</p>
            <Link href="/dashboard">
              <Button className="mt-4 w-full">Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if we're viewing just the report (via hash)
  const reportHtml = book.versions[0]?.reports?.find((r: Report) => r.status === "completed")?.htmlContent;

  // Extract scripts from HTML and prepare HTML without scripts
  const getReportContent = () => {
    if (!reportHtml) return { htmlWithoutScripts: '', scripts: [] };
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(reportHtml, 'text/html');
    const scripts = Array.from(doc.querySelectorAll('script')).map(script => ({
      attributes: Array.from(script.attributes).map(attr => ({ name: attr.name, value: attr.value })),
      content: script.textContent || ''
    }));
    
    // Remove script tags from the document
    doc.querySelectorAll('script').forEach(script => script.remove());
    
    // Get body content or full document if no body
    const bodyContent = doc.body ? doc.body.innerHTML : doc.documentElement.innerHTML;
    
    return {
      htmlWithoutScripts: bodyContent,
      scripts
    };
  };

  const reportContent = reportHtml ? getReportContent() : { htmlWithoutScripts: '', scripts: [] };

  // Execute scripts in report HTML after rendering
  useEffect(() => {
    if (isViewingReport && reportContainerRef.current && reportHtml) {
      // Extract and execute scripts from the HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(reportHtml, 'text/html');
      const scripts = doc.querySelectorAll('script');
      
      scripts.forEach((oldScript) => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach((attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });
        newScript.textContent = oldScript.textContent;
        reportContainerRef.current?.appendChild(newScript);
      });
    }
  }, [isViewingReport, reportHtml]);

  // If viewing report and HTML content exists, render just the HTML without wrapper
  // Only render after component is mounted to avoid SSR issues
  if (mounted && isViewingReport && reportHtml) {
    return (
      <div className="min-h-screen bg-white">
        <div ref={reportContainerRef} className="w-full" dangerouslySetInnerHTML={{ __html: reportContent.htmlWithoutScripts }} />
      </div>
    );
  }

  return (
    <>
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-3">
            <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-orange-600 text-sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
            {/* Combined Book Info and Report */}
            <Card>
              <CardContent className="p-3">
                <div className="flex gap-4 mb-6">
                  {/* Left side - Cover Image */}
                  <div className="flex-shrink-0">
                    {editMode ? (
                      <div className="relative mb-4">
                        {newCoverImagePreview || book.coverImageUrl ? (
                          <div className="relative">
                            <img
                              src={newCoverImagePreview || book.coverImageUrl}
                              alt={book.title}
                              className="w-32 h-auto rounded-lg shadow-md"
                            />
                            <label className="absolute bottom-2 right-2 bg-white/90 backdrop-blur rounded-full p-2 shadow-lg cursor-pointer hover:bg-white transition-colors">
                              <Edit2 className="w-4 h-4 text-gray-700" />
                              <input
                                type="file"
                                className="sr-only"
                                accept="image/*"
                                onChange={(e) => e.target.files?.[0] && handleCoverImageChange(e.target.files[0])}
                              />
                            </label>
                            {newCoverImagePreview && (
                              <button
                                onClick={() => {
                                  setNewCoverImage(null);
                                  setNewCoverImagePreview(null);
                                }}
                                className="absolute top-2 right-2 bg-white/90 backdrop-blur rounded-full p-1.5 shadow-lg hover:bg-white transition-colors"
                              >
                                <X className="w-3 h-3 text-red-600" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <label className="flex items-center justify-center w-32 min-h-[12rem] border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-orange-600 bg-gray-50">
                            <div className="text-center">
                              <Image className="mx-auto h-8 w-8 text-gray-400" />
                              <p className="mt-1 text-xs text-gray-600">Add Cover</p>
                            </div>
                            <input
                              type="file"
                              className="sr-only"
                              accept="image/*"
                              onChange={(e) => e.target.files?.[0] && handleCoverImageChange(e.target.files[0])}
                            />
                          </label>
                        )}
                      </div>
                    ) : (
                      <div className="mb-4">
                        {book.coverImageUrl ? (
                          <img
                            src={book.coverImageUrl}
                            alt={book.title}
                            className="w-32 h-auto rounded-lg shadow-md"
                          />
                        ) : (
                          <div className="w-32 h-48 bg-gradient-to-br from-orange-100 to-orange-50 rounded-lg flex items-center justify-center">
                            <Image className="w-12 h-12 text-orange-300" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right side - Book Details */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        {editMode ? (
                          <input
                            type="text"
                            value={editedTitle}
                            onChange={(e) => setEditedTitle(e.target.value)}
                            className="text-2xl font-bold w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                            placeholder="Book title"
                          />
                        ) : (
                          <h2 className="text-2xl font-bold text-gray-900">{book.title}</h2>
                        )}
                        <p className="text-sm text-gray-500 mt-1">
                          Added {new Date(book.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {!editMode ? (
                        !(digestJob?.status === "processing" || digestJob?.status === "pending") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditMode(true)}
                          >
                            <Edit2 className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                        )
                      ) : (
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEdit}
                            disabled={saving}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="bg-orange-600 hover:bg-orange-700"
                            onClick={handleSaveEdit}
                            disabled={saving || !editedTitle.trim()}
                          >
                            {saving ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4 mr-1" />
                                Save
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    {editMode ? (
                      <div>
                        <h3 className="font-semibold text-gray-700 mb-2">Description</h3>
                        <textarea
                          value={editedDescription}
                          onChange={(e) => setEditedDescription(e.target.value)}
                          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                          rows={6}
                          placeholder="Add a description of this book (optional)"
                        />
                      </div>
                    ) : (
                      book.description && (
                        <div>
                          <h3 className="font-semibold text-gray-700 mb-2">Description</h3>
                          <p className="text-gray-600">{book.description}</p>
                        </div>
                      )
                    )}
                  </div>
                </div>


                {/* Processing Status Banner */}
                {digestJob && (digestJob.status === "processing" || digestJob.status === "pending") && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mt-4">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                      <div className="flex-1">
                        <p className="text-orange-900 font-medium">Processing your manuscript</p>
                        <p className="text-orange-700 text-sm">Please wait while we analyze your book. This may take a few minutes.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Book Report section - Hide when processing or loading */}
                {digestLoaded && !(digestJob && (digestJob.status === "processing" || digestJob.status === "pending")) && (
                <div className="border-t pt-4 mt-4">
                {book.versions.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No manuscript uploaded yet</p>
                ) : (
                  <>
                    {/* Use first version for now - easy to add version selector later */}
                    {(() => {
                      const version = book.versions[0];
                      if (!version) return null;
                      return (
                        <>
                          {/* Tabs */}
                          <div className="border-b bg-gray-50">
                            <div className="flex">
                              <button
                                onClick={() => {
                                  setSelectedVersion(version);
                                  setActiveTab("summary");
                                }}
                                className={`flex-1 px-4 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
                                  activeTab === "summary"
                                    ? "text-orange-600 border-orange-600 bg-white"
                                    : "text-gray-600 border-transparent hover:text-gray-900"
                                }`}
                              >
                                <BookOpen className="w-4 h-4 inline-block mr-1" />
                                Summary
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedVersion(version);
                                  setActiveTab("author");
                                  if (version.reports.length > 0 && version.reports[0]) {
                                    setSelectedReport(version.reports[0]);
                                  }
                                }}
                                className={`flex-1 px-4 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
                                  activeTab === "author"
                                    ? "text-orange-600 border-orange-600 bg-white"
                                    : "text-gray-600 border-transparent hover:text-gray-900"
                                }`}
                              >
                                <FileText className="w-4 h-4 inline-block mr-1" />
                                Author Report
                                {version.reports.some(r => r.status === "completed") && (
                                  <CheckCircle className="w-3.5 h-3.5 inline-block ml-1 text-green-600" />
                                )}
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedVersion(version);
                                  setActiveTab("marketing");
                                }}
                                className={`flex-1 px-4 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
                                  activeTab === "marketing"
                                    ? "text-orange-600 border-orange-600 bg-white"
                                    : "text-gray-600 border-transparent hover:text-gray-900"
                                }`}
                              >
                                <Megaphone className="w-4 h-4 inline-block mr-1" />
                                Marketing
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedVersion(version);
                                  setActiveTab("campaigns");
                                }}
                                className={`flex-1 px-4 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
                                  activeTab === "campaigns"
                                    ? "text-orange-600 border-orange-600 bg-white"
                                    : "text-gray-600 border-transparent hover:text-gray-900"
                                }`}
                              >
                                <Users className="w-4 h-4 inline-block mr-1" />
                                Campaigns
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedVersion(version);
                                  setActiveTab("community");
                                }}
                                className={`flex-1 px-4 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
                                  activeTab === "community"
                                    ? "text-orange-600 border-orange-600 bg-white"
                                    : "text-gray-600 border-transparent hover:text-gray-900"
                                }`}
                              >
                                <MessageCircle className="w-4 h-4 inline-block mr-1" />
                                Community
                              </button>
                            </div>
                          </div>

                          {/* Tab Content */}
                          <div className="p-6">
                            {activeTab === "summary" && (
                              <div>
                                <div className="mb-4">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    Free
                                  </span>
                                </div>
                                {digestJob && digestJob.status === "completed" && digestJob.summary ? (
                                  <div className="space-y-4">
                                    <p className="text-gray-700">{digestJob.summary}</p>
                                    {digestJob.shortSummary && digestJob.shortSummary !== digestJob.summary && (
                                      <div>
                                        <h4 className="font-semibold text-gray-700 mb-1">Short Summary:</h4>
                                        <p className="text-gray-600 text-sm">{digestJob.shortSummary}</p>
                                      </div>
                                    )}
                                  </div>
                                ) : version.summary ? (
                                  <p className="text-gray-700">{version.summary}</p>
                                ) : (
                                  <p className="text-gray-500 italic">No summary available yet.</p>
                                )}
                              </div>
                            )}

                            {activeTab === "author" && (
                              <div>
                                {version.reports.length === 0 ? (
                                  <div className="text-center py-12">
                                    <Lock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Report Yet</h3>
                                    <p className="text-gray-600 mb-6">Get a professional analysis of your manuscript</p>
                                    <Button
                                      className="bg-orange-600 hover:bg-orange-700"
                                      onClick={() => handlePurchaseAnalysis(version.id)}
                                      disabled={purchasing}
                                    >
                                      {purchasing ? (
                                        <>
                                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                          Processing...
                                        </>
                                      ) : (
                                        <>
                                          <CreditCard className="w-4 h-4 mr-2" />
                                          Request Report
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                ) : version.reports.length > 0 && version.reports[0] ? (
                                  <div>
                                    {version.reports[0]!.status === "completed" ? (
                                      <>
                                        {version.reports[0]!.htmlContent ? (
                                          <div className="w-full"
                                               dangerouslySetInnerHTML={{ __html: version.reports[0]!.htmlContent }} />
                                        ) : (
                                          <div className="text-center py-12">
                                            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-600" />
                                            <h3 className="text-2xl font-semibold text-gray-900 mb-2">Report Ready</h3>
                                            <p className="text-gray-600 mb-6">Your analysis is complete and ready to download</p>
                                            <Button
                                              className="bg-green-600 hover:bg-green-700"
                                              onClick={() => window.location.href = `/api/books/${book?.id}/report/download`}
                                            >
                                              <Download className="w-4 h-4 mr-2" />
                                              Download Report
                                            </Button>
                                          </div>
                                        )}
                                      </>
                                    ) : version.reports[0]!.status === "analyzing" ? (
                                      <div className="text-center py-16">
                                        <div className="flex flex-col items-center">
                                          <div className="w-20 h-20 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mb-6" />
                                          <h3 className="text-2xl font-semibold text-gray-900 mb-2">Analyzing Your Manuscript</h3>
                                          <p className="text-gray-600">Our team is currently analyzing your manuscript</p>
                                          <p className="text-sm text-gray-500 mt-2">This usually takes a few hours</p>
                                        </div>
                                      </div>
                                    ) : (version.reports[0]!.status === "pending" || version.reports[0]!.status === "requested") ? (
                                      <div className="text-center py-16">
                                        <Clock className="w-16 h-16 mx-auto mb-4 text-yellow-600" />
                                        <h3 className="text-2xl font-semibold text-gray-900 mb-2">Report Requested</h3>
                                        <p className="text-gray-600">Your report has been requested</p>
                                        <p className="text-sm text-gray-500 mt-2">We'll start analyzing it soon</p>
                                      </div>
                                    ) : (
                                      <div className="text-center py-16">
                                        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                                        <h3 className="text-2xl font-semibold text-gray-900 mb-2">Unknown Status</h3>
                                        <p className="text-gray-600">Please contact support</p>
                                      </div>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            )}

                            {activeTab === "marketing" && (
                              <div className="text-center py-8">
                                <Megaphone className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <h3 className="font-semibold text-gray-900 mb-2">Marketing Report</h3>
                                <p className="text-gray-600 text-sm mb-4">
                                  Get personalized marketing strategies, target audience analysis, and promotional campaigns tailored to your book.
                                </p>
                                <Button variant="outline" disabled>
                                  Coming Soon
                                </Button>
                              </div>
                            )}

                            {activeTab === "campaigns" && (
                              <div className="text-center py-8">
                                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <h3 className="font-semibold text-gray-900 mb-2">Campaign Management</h3>
                                <p className="text-gray-600 text-sm mb-4">
                                  Launch and manage book campaigns, pre-orders, and reader engagement initiatives.
                                </p>
                                <Button variant="outline" disabled>
                                  Coming Soon
                                </Button>
                              </div>
                            )}

                            {activeTab === "community" && (
                              <div className="text-center py-8">
                                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <h3 className="font-semibold text-gray-900 mb-2">Community Features</h3>
                                <p className="text-gray-600 text-sm mb-4">
                                  Connect with other authors, share experiences, and get feedback from the writing community.
                                </p>
                                <Button variant="outline" disabled>
                                  Coming Soon
                                </Button>
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}
                </div>
                )}
              </CardContent>
            </Card>
        </div>
      </main>
    </>
  );
}