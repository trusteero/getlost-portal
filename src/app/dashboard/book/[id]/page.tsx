"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
  status: "pending" | "analyzing" | "completed";
  requestedAt: string;
  completedAt?: string;
  htmlContent?: string;
  pdfUrl?: string;
}

interface Book {
  id: string;
  title: string;
  personalNotes?: string;
  coverImageUrl?: string;
  createdAt: string;
  versions: BookVersion[];
}

export default function BookDetail() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
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
  const [editedNotes, setEditedNotes] = useState("");
  const [newCoverImage, setNewCoverImage] = useState<File | null>(null);
  const [newCoverImagePreview, setNewCoverImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchBook();
    }
  }, [status, params.id]);

  const fetchBook = async () => {
    try {
      const response = await fetch(`/api/books/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setBook(data);
        setEditedTitle(data.title);
        setEditedNotes(data.personalNotes || "");

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
        }
      }
    } catch (error) {
      console.error("Failed to fetch book:", error);
    } finally {
      setLoading(false);
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

  const handleSaveEdit = async () => {
    if (!editedTitle.trim()) return;

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("title", editedTitle);
      formData.append("personalNotes", editedNotes);
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

  const handleCancelEdit = () => {
    setEditedTitle(book?.title || "");
    setEditedNotes(book?.personalNotes || "");
    setNewCoverImage(null);
    setNewCoverImagePreview(null);
    setEditMode(false);
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
        return "Waiting for analysis";
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
            {/* Book Info */}
            <Card>
              <CardContent className="p-6">
                <div className="flex gap-6">
                  {/* Left side - Cover Image */}
                  <div className="flex-shrink-0">
                    {editMode ? (
                      <div className="relative mb-4">
                        {newCoverImagePreview || book.coverImageUrl ? (
                          <div className="relative">
                            <img
                              src={newCoverImagePreview || book.coverImageUrl}
                              alt={book.title}
                              className="w-32 h-48 object-cover rounded-lg shadow-md"
                            />
                            <label className="absolute bottom-2 right-2 bg-white/90 backdrop-blur rounded-full p-2 shadow-lg cursor-pointer hover:bg-white transition-colors">
                              <Edit2 className="w-4 h-4 text-gray-700" />
                              <input
                                type="file"
                                className="sr-only"
                                accept="image/*"
                                onChange={(e) => e.target.files && handleCoverImageChange(e.target.files[0])}
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
                          <label className="flex items-center justify-center w-32 h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-orange-600 bg-gray-50">
                            <div className="text-center">
                              <Image className="mx-auto h-8 w-8 text-gray-400" />
                              <p className="mt-1 text-xs text-gray-600">Add Cover</p>
                            </div>
                            <input
                              type="file"
                              className="sr-only"
                              accept="image/*"
                              onChange={(e) => e.target.files && handleCoverImageChange(e.target.files[0])}
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
                            className="w-32 h-48 object-cover rounded-lg shadow-md"
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
                          Created {new Date(book.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {!editMode ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditMode(true)}
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
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

                    {/* Personal Notes */}
                    {editMode ? (
                      <div>
                        <h3 className="font-semibold text-gray-700 mb-2">Personal Notes</h3>
                        <textarea
                          value={editedNotes}
                          onChange={(e) => setEditedNotes(e.target.value)}
                          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                          rows={6}
                          placeholder="Add any notes about this book (optional)"
                        />
                      </div>
                    ) : (
                      book.personalNotes && (
                        <div>
                          <h3 className="font-semibold text-gray-700 mb-2">Personal Notes</h3>
                          <p className="text-gray-600">{book.personalNotes}</p>
                        </div>
                      )
                    )}
                  </div>
                </div>

              </CardContent>
            </Card>

            {/* Book Report */}
            <Card>
              <CardHeader>
                <CardTitle>Book Report</CardTitle>
                <CardDescription>
                  View and manage your book analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {book.versions.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No manuscript uploaded yet</p>
                ) : (
                  <>
                    {/* Use first version for now - easy to add version selector later */}
                    {(() => {
                      const version = book.versions[0];
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
                                  if (version.reports.length > 0) {
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
                                {version.summary ? (
                                  <p className="text-gray-700">{version.summary}</p>
                                ) : (
                                  <p className="text-gray-500 italic">No summary available yet.</p>
                                )}
                              </div>
                            )}

                            {activeTab === "author" && (
                              <div>
                                {version.reports.length === 0 ? (
                                  <div className="text-center py-8">
                                    <Lock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                    <p className="text-gray-600 mb-4">Get a professional analysis of your manuscript</p>
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
                                          Get Analysis ($39)
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                ) : (
                                  <div>
                                    {version.reports[0].status === "completed" ? (
                                      <>
                                        <div className="mb-4">
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            <CheckCircle className="w-3 h-3 mr-1" />
                                            Unlocked
                                          </span>
                                        </div>
                                        {version.reports[0].htmlContent && (
                                          <div className="prose prose-sm max-w-none"
                                               dangerouslySetInnerHTML={{ __html: version.reports[0].htmlContent }} />
                                        )}
                                      </>
                                    ) : (
                                      <div className="text-center py-8">
                                        <div className="flex flex-col items-center">
                                          {getStatusIcon(version.reports[0].status)}
                                          <p className="mt-2 text-gray-600">{getStatusText(version.reports[0].status)}</p>
                                          {version.reports[0].status === "pending" && (
                                            <p className="text-sm text-gray-500 mt-1">
                                              Your report will be ready in 1-3 business days
                                            </p>
                                          )}
                                          {version.reports[0].status === "analyzing" && (
                                            <p className="text-sm text-gray-500 mt-1">
                                              Our team is currently analyzing your manuscript
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
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
              </CardContent>
            </Card>
        </div>
      </main>
    </>
  );
}