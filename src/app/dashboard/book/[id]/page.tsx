"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft, Upload, FileText, Clock, CheckCircle, AlertCircle,
  Download, Eye, CreditCard, Loader2, ChevronDown, ChevronRight, Edit2, Save, X, Image
} from "lucide-react";

interface BookVersion {
  id: string;
  versionNumber: number;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadedAt: string;
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-orange-600">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Book Info & Versions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Book Info */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
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
                      <CardTitle className="text-2xl">{book.title}</CardTitle>
                    )}
                    <CardDescription className="mt-1">
                      Created {new Date(book.createdAt).toLocaleDateString()}
                    </CardDescription>
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
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={saving}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-700"
                        onClick={handleSaveEdit}
                        disabled={saving || !editedTitle.trim()}
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6">
                  {/* Cover Image */}
                  <div className="flex-shrink-0">
                    {editMode ? (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Cover Image</label>
                        <div className="relative">
                          {newCoverImagePreview ? (
                            <div className="relative">
                              <img
                                src={newCoverImagePreview}
                                alt="New cover"
                                className="w-32 h-48 object-cover rounded-lg border"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setNewCoverImage(null);
                                  setNewCoverImagePreview(null);
                                }}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : book.coverImageUrl ? (
                            <div className="relative">
                              <img
                                src={book.coverImageUrl}
                                alt="Cover"
                                className="w-32 h-48 object-cover rounded-lg border"
                              />
                              <label className="absolute bottom-2 right-2 bg-white rounded-full p-2 shadow cursor-pointer hover:bg-gray-100">
                                <Edit2 className="w-3 h-3" />
                                <input
                                  type="file"
                                  className="sr-only"
                                  accept="image/*"
                                  onChange={(e) => e.target.files && handleCoverImageChange(e.target.files[0])}
                                />
                              </label>
                            </div>
                          ) : (
                            <label className="flex items-center justify-center w-32 h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-orange-600">
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
                      </div>
                    ) : (
                      book.coverImageUrl && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Cover Image</label>
                          <img
                            src={book.coverImageUrl}
                            alt="Cover"
                            className="w-32 h-48 object-cover rounded-lg border"
                          />
                        </div>
                      )
                    )}
                  </div>

                  {/* Notes */}
                  <div className="flex-1">
                    {editMode ? (
                      <div>
                        <h3 className="font-semibold text-gray-700 mb-2">Personal Notes</h3>
                        <textarea
                          value={editedNotes}
                          onChange={(e) => setEditedNotes(e.target.value)}
                          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                          rows={4}
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

                {/* Upload New Version */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-gray-700 mb-3">Upload New Version</h3>
                  {newVersionFile ? (
                    <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                      <div className="flex items-center">
                        <FileText className="w-5 h-5 text-orange-600 mr-2" />
                        <span className="text-sm">{newVersionFile.name}</span>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setNewVersionFile(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="bg-orange-600 hover:bg-orange-700"
                          onClick={handleUploadNewVersion}
                          disabled={uploadingNewVersion}
                        >
                          {uploadingNewVersion ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Upload"
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-orange-600">
                      <Upload className="w-5 h-5 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-600">Click to upload new version</span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".doc,.docx,.pdf,.epub"
                        onChange={(e) => e.target.files && setNewVersionFile(e.target.files[0])}
                      />
                    </label>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Versions & Reports */}
            <Card>
              <CardHeader>
                <CardTitle>Versions & Reports</CardTitle>
                <CardDescription>
                  Manage your manuscript versions and their analysis reports
                </CardDescription>
              </CardHeader>
              <CardContent>
                {book.versions.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No versions uploaded yet</p>
                ) : (
                  <div className="space-y-3">
                    {book.versions.map((version) => (
                      <div key={version.id} className="border rounded-lg">
                        <button
                          className="w-full p-3 flex items-center justify-between hover:bg-gray-50"
                          onClick={() => toggleVersion(version.id)}
                        >
                          <div className="flex items-center">
                            {expandedVersions.has(version.id) ? (
                              <ChevronDown className="w-4 h-4 mr-2" />
                            ) : (
                              <ChevronRight className="w-4 h-4 mr-2" />
                            )}
                            <div className="text-left">
                              <p className="font-medium">Version {version.versionNumber}</p>
                              <p className="text-sm text-gray-500">{version.fileName}</p>
                            </div>
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(version.uploadedAt).toLocaleDateString()}
                          </span>
                        </button>

                        {expandedVersions.has(version.id) && (
                          <div className="px-3 pb-3 border-t">
                            {version.reports.length === 0 ? (
                              <div className="py-4 text-center">
                                <p className="text-gray-500 mb-3">No analysis report yet</p>
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
                              <div className="pt-3 space-y-2">
                                {version.reports.map((report) => (
                                  <div
                                    key={report.id}
                                    className={`p-3 rounded-md border cursor-pointer ${
                                      selectedReport?.id === report.id
                                        ? "bg-orange-50 border-orange-300"
                                        : "hover:bg-gray-50"
                                    }`}
                                    onClick={() => setSelectedReport(report)}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center">
                                        {getStatusIcon(report.status)}
                                        <span className="ml-2 text-sm font-medium">
                                          {getStatusText(report.status)}
                                        </span>
                                      </div>
                                      {report.status === "completed" && (
                                        <div className="flex space-x-2">
                                          <Button size="sm" variant="outline">
                                            <Eye className="w-4 h-4 mr-1" />
                                            View
                                          </Button>
                                          {report.pdfUrl && (
                                            <Button size="sm" variant="outline">
                                              <Download className="w-4 h-4 mr-1" />
                                              PDF
                                            </Button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Requested {new Date(report.requestedAt).toLocaleString()}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Report Preview */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Report Preview</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedReport ? (
                  selectedReport.status === "completed" && selectedReport.htmlContent ? (
                    <div className="prose prose-sm max-w-none">
                      <div dangerouslySetInnerHTML={{ __html: selectedReport.htmlContent }} />
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="flex flex-col items-center">
                        {getStatusIcon(selectedReport.status)}
                        <p className="mt-2 text-gray-600">{getStatusText(selectedReport.status)}</p>
                        {selectedReport.status === "pending" && (
                          <p className="text-sm text-gray-500 mt-1">
                            Your report will be ready in 1-3 business days
                          </p>
                        )}
                        {selectedReport.status === "analyzing" && (
                          <p className="text-sm text-gray-500 mt-1">
                            Our team is currently analyzing your manuscript
                          </p>
                        )}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Select a report to preview</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}