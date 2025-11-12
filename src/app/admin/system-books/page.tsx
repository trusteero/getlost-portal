"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "@/lib/auth-client";
import {
  BookOpen,
  FileText,
  Image as ImageIcon,
  Video,
  Globe,
  Upload,
  Trash2,
  Plus,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Settings,
  LogOut,
  Home,
  ChevronDown,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SeededReport {
  id: string;
  status: string;
  seededFileName: string | null;
  seededFolder: string | null;
  htmlContent: string | null;
  requestedAt: string;
  completedAt: string | null;
  uploadFileNames?: string[];
}

interface MarketingAsset {
  id: string;
  assetType: string;
  title: string | null;
  description: string | null;
  fileUrl: string | null;
  thumbnailUrl: string | null;
  status: string;
  uploadFileNames?: string[];
}

interface BookCover {
  id: string;
  coverType: string;
  title: string | null;
  imageUrl: string;
  thumbnailUrl: string | null;
  isPrimary: boolean;
  status: string;
  uploadFileNames?: string[];
}

interface LandingPage {
  id: string;
  slug: string;
  title: string | null;
  headline: string | null;
  subheadline: string | null;
  description: string | null;
  htmlContent: string | null;
  status: string;
  uploadFileNames?: string[];
}

interface SystemBookData {
  systemBook: {
    id: string;
    title: string;
  } | null;
  reports: SeededReport[];
  marketingAssets: MarketingAsset[];
  covers: BookCover[];
  landingPages: LandingPage[];
}

export default function SystemBooksAdmin() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [data, setData] = useState<SystemBookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"reports" | "marketing" | "covers" | "landing">("reports");
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadAssetType, setUploadAssetType] = useState<"marketing-assets" | "covers" | "landing-page">("marketing-assets");
  const [uploadReportDialogOpen, setUploadReportDialogOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [uploadingReport, setUploadingReport] = useState(false);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedReportForMapping, setSelectedReportForMapping] = useState<SeededReport | null>(null);
  const [selectedAssetForMapping, setSelectedAssetForMapping] = useState<MarketingAsset | BookCover | LandingPage | null>(null);
  const [mappingAssetType, setMappingAssetType] = useState<"marketing" | "cover" | "landing" | null>(null);
  const [savingMappings, setSavingMappings] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (isPending) return;

    if (!session) {
      router.push("/login");
      return;
    }

    const checkAdmin = async () => {
      try {
        const response = await fetch("/api/admin/check");
        const data = await response.json();

        if (!data.isAdmin) {
          router.push("/dashboard");
          return;
        }

        fetchData();
      } catch (error) {
        console.error("Failed to check admin status:", error);
        router.push("/dashboard");
      }
    };

    if (session) {
      checkAdmin();
    }
  }, [isPending, session]);

  const fetchData = async () => {
    try {
      const response = await fetch("/api/admin/system-books");
      if (response.ok) {
        const systemData = await response.json();
        setData(systemData);
      }
    } catch (error) {
      console.error("Failed to fetch system books:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleUploadAsset = async (formData: FormData) => {
    if (!data?.systemBook) return;

    setUploading(true);
    try {
      const response = await fetch(
        `/api/admin/system-books/${data.systemBook.id}/assets/${uploadAssetType}`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (response.ok) {
        await fetchData();
        setUploadDialogOpen(false);
        alert("Asset uploaded successfully");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to upload asset");
      }
    } catch (error) {
      console.error("Failed to upload asset:", error);
      alert("Failed to upload asset");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAsset = async (assetType: string, assetId: string) => {
    if (!data?.systemBook) return;
    if (!confirm("Are you sure you want to delete this asset?")) return;

    try {
      const response = await fetch(
        `/api/admin/system-books/${data.systemBook.id}/assets/${assetType}/${assetId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        await fetchData();
        alert("Asset deleted successfully");
      } else {
        alert("Failed to delete asset");
      }
    } catch (error) {
      console.error("Failed to delete asset:", error);
      alert("Failed to delete asset");
    }
  };

  const handleUploadReport = async (reportId: string, file: File) => {
    setUploadingReport(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/admin/reports/${reportId}/upload`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        await fetchData();
        setUploadReportDialogOpen(false);
        setSelectedReportId(null);
        alert("Report uploaded successfully");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to upload report");
      }
    } catch (error) {
      console.error("Failed to upload report:", error);
      alert("Failed to upload report");
    } finally {
      setUploadingReport(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("Are you sure you want to delete this report? This cannot be undone.")) return;

    try {
      const response = await fetch(`/api/admin/reports/${reportId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchData();
        alert("Report deleted successfully");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete report");
      }
    } catch (error) {
      console.error("Failed to delete report:", error);
      alert("Failed to delete report");
    }
  };

  const handleUpdateReportStatus = async (reportId: string, status: string) => {
    try {
      const response = await fetch(`/api/admin/reports/${reportId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        await fetchData();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update report status");
      }
    } catch (error) {
      console.error("Failed to update report status:", error);
      alert("Failed to update report status");
    }
  };

  const handleSaveReportMappings = async (reportId: string, mappings: string[]) => {
    setSavingMappings(true);
    try {
      const response = await fetch(`/api/admin/reports/${reportId}/mapping`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadFileNames: mappings }),
      });

      if (response.ok) {
        await fetchData();
        setMappingDialogOpen(false);
        setSelectedReportForMapping(null);
        alert("Upload filename mappings saved");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to save mappings");
      }
    } catch (error) {
      console.error("Failed to save report mappings:", error);
      alert("Failed to save mappings");
    } finally {
      setSavingMappings(false);
    }
  };

  const handleSaveAssetMappings = async (assetId: string, assetType: "marketing" | "cover" | "landing", mappings: string[]) => {
    setSavingMappings(true);
    try {
      const endpoint = assetType === "marketing" 
        ? `/api/admin/marketing-assets/${assetId}/mapping`
        : assetType === "cover"
        ? `/api/admin/covers/${assetId}/mapping`
        : `/api/admin/landing-pages/${assetId}/mapping`;
      
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadFileNames: mappings }),
      });

      if (response.ok) {
        await fetchData();
        setMappingDialogOpen(false);
        setSelectedAssetForMapping(null);
        setMappingAssetType(null);
        alert("Upload filename mappings saved");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to save mappings");
      }
    } catch (error) {
      console.error("Failed to save asset mappings:", error);
      alert("Failed to save mappings");
    } finally {
      setSavingMappings(false);
    }
  };

  if (loading || isPending) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card>
          <CardContent className="p-8">
            <p className="text-center text-gray-600">Failed to load system books data</p>
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
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <img src="/logo256.png" alt="Get Lost" className="h-8 w-8" />
                <span className="text-2xl font-bold text-orange-600">Get Lost</span>
              </Link>
              <span className="ml-4 text-gray-600">System Books Admin</span>
            </div>
            <div className="flex items-center space-x-3">
              <Link href="/admin">
                <Button variant="outline" size="sm">
                  <Home className="w-4 h-4 mr-1" />
                  Admin Dashboard
                </Button>
              </Link>

              {/* User menu dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {session?.user?.name?.charAt(0)?.toUpperCase() ||
                        session?.user?.email?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {session?.user?.name || session?.user?.email?.split("@")[0]}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-500 transition-transform ${
                      dropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {dropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-20">
                      <div className="px-4 py-3 border-b border-gray-200">
                        <p className="text-sm text-gray-500">Admin</p>
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {session?.user?.email}
                        </p>
                      </div>
                      <div className="py-1">
                        <Link
                          href="/settings"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <Settings className="w-4 h-4 mr-3 text-gray-500" />
                          Settings
                        </Link>
                        <button
                          onClick={async () => {
                            setDropdownOpen(false);
                            await signOut();
                            window.location.href = "/";
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <LogOut className="w-4 h-4 mr-3 text-gray-500" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">System Books Management</h1>
            <p className="text-gray-600 mt-1">
              Manage seeded reports and purchasable assets for matching with author uploads
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>

        {!data.systemBook ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-600 mb-4">
                System book not found. Run the seed script to create it.
              </p>
              <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                node scripts/seed-reports-only.js
              </code>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Tabs */}
            <div className="mb-6 flex space-x-2 border-b">
              <button
                onClick={() => setActiveTab("reports")}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === "reports"
                    ? "border-orange-600 text-orange-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                <FileText className="w-4 h-4 inline-block mr-2" />
                Reports ({data.reports.length})
              </button>
              <button
                onClick={() => setActiveTab("marketing")}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === "marketing"
                    ? "border-orange-600 text-orange-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                <Video className="w-4 h-4 inline-block mr-2" />
                Marketing Assets ({data.marketingAssets.length})
              </button>
              <button
                onClick={() => setActiveTab("covers")}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === "covers"
                    ? "border-orange-600 text-orange-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                <ImageIcon className="w-4 h-4 inline-block mr-2" />
                Book Covers ({data.covers.length})
              </button>
              <button
                onClick={() => setActiveTab("landing")}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === "landing"
                    ? "border-orange-600 text-orange-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                <Globe className="w-4 h-4 inline-block mr-2" />
                Landing Pages ({data.landingPages.length})
              </button>
            </div>

            {/* Content */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>
                      {activeTab === "reports" && "Seeded Reports"}
                      {activeTab === "marketing" && "Marketing Assets"}
                      {activeTab === "covers" && "Book Covers"}
                      {activeTab === "landing" && "Landing Pages"}
                    </CardTitle>
                    <CardDescription>
                      {activeTab === "reports" &&
                        "Reports that are automatically matched with author uploads by filename"}
                      {activeTab === "marketing" &&
                        "Marketing assets available for purchase"}
                      {activeTab === "covers" &&
                        "Book covers available for purchase"}
                      {activeTab === "landing" &&
                        "Landing pages available for purchase"}
                    </CardDescription>
                  </div>
                  {activeTab !== "reports" && (
                    <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          onClick={() => setUploadAssetType(activeTab === "marketing" ? "marketing-assets" : activeTab === "covers" ? "covers" : "landing-page")}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add {activeTab === "marketing" ? "Marketing Asset" : activeTab === "covers" ? "Cover" : "Landing Page"}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            Upload {activeTab === "marketing" ? "Marketing Asset" : activeTab === "covers" ? "Cover" : "Landing Page"}
                          </DialogTitle>
                          <DialogDescription>
                            {activeTab === "marketing" && "Upload a marketing asset (video, image, etc.)"}
                            {activeTab === "covers" && "Upload a book cover"}
                            {activeTab === "landing" && "Create a landing page"}
                          </DialogDescription>
                        </DialogHeader>
                        <UploadAssetForm
                          assetType={uploadAssetType}
                          onSubmit={handleUploadAsset}
                          uploading={uploading}
                        />
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {activeTab === "reports" && (
                  <ReportsTab 
                    reports={data.reports} 
                    onUpload={(reportId) => {
                      setSelectedReportId(reportId);
                      setUploadReportDialogOpen(true);
                    }}
                    onDelete={handleDeleteReport}
                    onUpdateStatus={handleUpdateReportStatus}
                    onManageMappings={(report) => {
                      setSelectedReportForMapping(report);
                      setMappingDialogOpen(true);
                    }}
                  />
                )}
                {activeTab === "marketing" && (
                  <MarketingAssetsTab
                    assets={data.marketingAssets}
                    onDelete={(id) => handleDeleteAsset("marketing-assets", id)}
                    onManageMappings={(asset) => {
                      setSelectedAssetForMapping(asset);
                      setMappingAssetType("marketing");
                      setMappingDialogOpen(true);
                    }}
                  />
                )}
                {activeTab === "covers" && (
                  <CoversTab
                    covers={data.covers}
                    onDelete={(id) => handleDeleteAsset("covers", id)}
                    onManageMappings={(cover) => {
                      setSelectedAssetForMapping(cover);
                      setMappingAssetType("cover");
                      setMappingDialogOpen(true);
                    }}
                  />
                )}
                {activeTab === "landing" && (
                  <LandingPagesTab
                    pages={data.landingPages}
                    onDelete={(id) => handleDeleteAsset("landing-page", id)}
                    onManageMappings={(page) => {
                      setSelectedAssetForMapping(page);
                      setMappingAssetType("landing");
                      setMappingDialogOpen(true);
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Upload Report Dialog */}
        <Dialog open={uploadReportDialogOpen} onOpenChange={setUploadReportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Report HTML</DialogTitle>
              <DialogDescription>
                Upload a pre-bundled standalone HTML report (images already embedded).
              </DialogDescription>
            </DialogHeader>
            <UploadReportForm
              reportId={selectedReportId || ""}
              onSubmit={handleUploadReport}
              uploading={uploadingReport}
            />
          </DialogContent>
        </Dialog>

        {/* Map Upload Filenames Dialog */}
        <Dialog
          open={mappingDialogOpen}
          onOpenChange={(open) => {
            setMappingDialogOpen(open);
            if (!open) {
              setSelectedReportForMapping(null);
              setSelectedAssetForMapping(null);
              setMappingAssetType(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configure Upload Filename Mapping</DialogTitle>
              <DialogDescription>
                {selectedReportForMapping
                  ? "Add alternate filenames that should map to the selected seeded report."
                  : selectedAssetForMapping
                  ? `Add alternate filenames that should map to the selected ${mappingAssetType === "marketing" ? "marketing asset" : mappingAssetType === "cover" ? "book cover" : "landing page"}.`
                  : ""}
              </DialogDescription>
            </DialogHeader>
            {selectedReportForMapping && (
              <EditMappingForm
                report={selectedReportForMapping}
                onSubmit={handleSaveReportMappings}
                saving={savingMappings}
              />
            )}
            {selectedAssetForMapping && mappingAssetType && (
              <EditMappingForm
                asset={selectedAssetForMapping}
                assetType={mappingAssetType}
                onSubmit={(id, mappings) =>
                  handleSaveAssetMappings(id, mappingAssetType, mappings)
                }
                saving={savingMappings}
              />
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function ReportsTab({ 
  reports, 
  onUpload,
  onDelete,
  onUpdateStatus,
  onManageMappings,
}: { 
  reports: SeededReport[];
  onUpload: (reportId: string) => void;
  onDelete: (reportId: string) => void;
  onUpdateStatus: (reportId: string, status: string) => void;
  onManageMappings: (report: SeededReport) => void;
}) {
  return (
    <div className="space-y-4">
      {reports.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No seeded reports found</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-4">Filename</th>
                <th className="text-left py-2 px-4">Folder</th>
                <th className="text-left py-2 px-4">Upload Aliases</th>
                <th className="text-left py-2 px-4">Status</th>
                <th className="text-left py-2 px-4">Has HTML</th>
                <th className="text-left py-2 px-4">Requested</th>
                <th className="text-left py-2 px-4">Completed</th>
                <th className="text-left py-2 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-4 font-mono text-xs">
                    {report.seededFileName || "-"}
                  </td>
                  <td className="py-2 px-4 text-gray-600">
                    {report.seededFolder || "-"}
                  </td>
                  <td className="py-2 px-4 text-gray-600">
                    {report.uploadFileNames && report.uploadFileNames.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {report.uploadFileNames.map((name) => (
                          <span
                            key={name}
                            className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 text-xs"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">None</span>
                    )}
                  </td>
                  <td className="py-2 px-4">
                    <select
                      value={report.status}
                      onChange={(e) => onUpdateStatus(report.id, e.target.value)}
                      className="text-xs border rounded px-2 py-1 bg-white"
                      disabled={report.status === "pending"}
                    >
                      <option value="pending">Pending</option>
                      <option value="analyzing">Analyzing</option>
                      <option value="completed">Completed</option>
                    </select>
                  </td>
                  <td className="py-2 px-4">
                    {report.htmlContent ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-400" />
                    )}
                  </td>
                  <td className="py-2 px-4 text-xs text-gray-600">
                    {new Date(report.requestedAt).toLocaleString()}
                  </td>
                  <td className="py-2 px-4 text-xs text-gray-600">
                    {report.completedAt
                      ? new Date(report.completedAt).toLocaleString()
                      : "-"}
                  </td>
                  <td className="py-2 px-4">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onUpload(report.id)}
                        title="Upload or update HTML report"
                      >
                        <Upload className="w-3 h-3 mr-1" />
                        {report.htmlContent ? "Update" : "Upload"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onManageMappings(report)}
                        title="Configure upload filename aliases"
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Map
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDelete(report.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Delete report"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MarketingAssetsTab({
  assets,
  onDelete,
  onManageMappings,
}: {
  assets: MarketingAsset[];
  onDelete: (id: string) => void;
  onManageMappings: (asset: MarketingAsset) => void;
}) {
  return (
    <div className="space-y-4">
      {assets.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No marketing assets found</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((asset) => (
            <Card key={asset.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold">{asset.title || "Untitled"}</h3>
                    <p className="text-sm text-gray-600">{asset.assetType}</p>
                    {asset.description && (
                      <p className="text-xs text-gray-500 mt-1">{asset.description}</p>
                    )}
                    {asset.uploadFileNames && asset.uploadFileNames.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {asset.uploadFileNames.map((name) => (
                          <span
                            key={name}
                            className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 text-xs"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(asset.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
                {asset.thumbnailUrl && (
                  <div className="mt-2">
                    <img
                      src={asset.thumbnailUrl}
                      alt={asset.title || "Asset"}
                      className="w-full h-32 object-cover rounded"
                    />
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      asset.status === "completed"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {asset.status}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onManageMappings(asset)}
                    title="Configure upload filename aliases"
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    Map
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CoversTab({
  covers,
  onDelete,
  onManageMappings,
}: {
  covers: BookCover[];
  onDelete: (id: string) => void;
  onManageMappings: (cover: BookCover) => void;
}) {
  return (
    <div className="space-y-4">
      {covers.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No covers found</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {covers.map((cover) => (
            <Card key={cover.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold">{cover.title || "Untitled"}</h3>
                    <p className="text-sm text-gray-600">{cover.coverType}</p>
                    {cover.isPrimary && (
                      <span className="text-xs text-blue-600 font-medium">Primary</span>
                    )}
                    {cover.uploadFileNames && cover.uploadFileNames.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {cover.uploadFileNames.map((name) => (
                          <span
                            key={name}
                            className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 text-xs"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(cover.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
                {cover.imageUrl && (
                  <div className="mt-2">
                    <img
                      src={cover.imageUrl}
                      alt={cover.title || "Cover"}
                      className="w-full h-48 object-cover rounded"
                    />
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      cover.status === "completed"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {cover.status}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onManageMappings(cover)}
                    title="Configure upload filename aliases"
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    Map
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function LandingPagesTab({
  pages,
  onDelete,
  onManageMappings,
}: {
  pages: LandingPage[];
  onDelete: (id: string) => void;
  onManageMappings: (page: LandingPage) => void;
}) {
  return (
    <div className="space-y-4">
      {pages.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No landing pages found</p>
      ) : (
        <div className="space-y-4">
          {pages.map((page) => (
            <Card key={page.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold">{page.title || "Untitled"}</h3>
                    <p className="text-sm text-gray-600">Slug: {page.slug}</p>
                    {page.headline && (
                      <p className="text-sm font-medium mt-1">{page.headline}</p>
                    )}
                    {page.subheadline && (
                      <p className="text-xs text-gray-600 mt-1">{page.subheadline}</p>
                    )}
                    {page.description && (
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                        {page.description}
                      </p>
                    )}
                    {page.uploadFileNames && page.uploadFileNames.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {page.uploadFileNames.map((name) => (
                          <span
                            key={name}
                            className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 text-xs"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onManageMappings(page)}
                      title="Configure upload filename aliases"
                    >
                      <FileText className="w-3 h-3 mr-1" />
                      Map
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDelete(page.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      page.status === "published"
                        ? "bg-green-100 text-green-800"
                        : page.status === "draft"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {page.status}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function UploadReportForm({
  reportId,
  onSubmit,
  uploading,
}: {
  reportId: string;
  onSubmit: (reportId: string, file: File) => Promise<void>;
  uploading: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert("Please select a file");
      return;
    }
    await onSubmit(reportId, file);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="reportFile">Standalone HTML File *</Label>
        <Input
          id="reportFile"
          type="file"
          accept=".html,.htm"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          Upload a self-contained HTML file with all images already inlined (data URLs).
        </p>
      </div>
      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setFile(null);
            // Dialog will be closed by parent
          }}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={uploading || !file}>
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function EditMappingForm({
  report,
  asset,
  assetType,
  onSubmit,
  saving,
}: {
  report?: SeededReport;
  asset?: MarketingAsset | BookCover | LandingPage;
  assetType?: "marketing" | "cover" | "landing";
  onSubmit: (id: string, mappings: string[]) => Promise<void>;
  saving: boolean;
}) {
  const item = report || asset;
  const currentMappings = item?.uploadFileNames || [];
  const [aliasInput, setAliasInput] = useState(currentMappings.join("\n"));

  useEffect(() => {
    setAliasInput(currentMappings.join("\n"));
  }, [item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    
    const mappings = aliasInput
      .split(/[\n,]+/)
      .map((value) => value.trim())
      .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);

    await onSubmit(item.id, mappings);
  };

  const displayName = report
    ? report.seededFileName || "N/A"
    : asset
    ? asset.title || (asset as BookCover).coverType || (asset as LandingPage).slug || "N/A"
    : "N/A";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-orange-50 border border-orange-200 rounded-md p-3 text-xs text-orange-800">
        <p className="font-medium">
          {report ? "Seeded filename:" : assetType === "marketing" ? "Marketing asset:" : assetType === "cover" ? "Book cover:" : "Landing page:"}
        </p>
        <p className="font-mono">{displayName}</p>
        <p className="mt-2">
          Provide any alternate filenames (one per line or comma-separated) that should map to this {report ? "report" : assetType === "marketing" ? "marketing asset" : assetType === "cover" ? "book cover" : "landing page"}.
        </p>
      </div>
      <div>
        <Label htmlFor="mappingAliases">Upload Filenames</Label>
        <Textarea
          id="mappingAliases"
          value={aliasInput}
          onChange={(e) => setAliasInput(e.target.value)}
          rows={6}
          className="font-mono text-xs"
          placeholder="Example:\nThe Broken Crown.pdf\nBC FULL - THIRD DRAFT.pdf"
        />
        <p className="text-xs text-gray-500 mt-1">
          We'll compare upload names against these aliases and the {report ? "seeded filename" : "asset name"}.
        </p>
      </div>
      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setAliasInput(currentMappings.join("\n"));
          }}
        >
          Reset
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function UploadAssetForm({
  assetType,
  onSubmit,
  uploading,
}: {
  assetType: "marketing-assets" | "covers" | "landing-page";
  onSubmit: (formData: FormData) => Promise<void>;
  uploading: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [headline, setHeadline] = useState("");
  const [subheadline, setSubheadline] = useState("");
  const [coverType, setCoverType] = useState("ebook");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();

    if (assetType === "landing-page") {
      formData.append("htmlContent", htmlContent);
      formData.append("headline", headline);
      formData.append("subheadline", subheadline);
      formData.append("description", description);
    } else {
      if (!file) {
        alert("Please select a file");
        return;
      }
      formData.append("file", file);
      formData.append("title", title);
      formData.append("description", description);
      if (assetType === "covers") {
        formData.append("coverType", coverType);
      }
    }

    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {assetType === "landing-page" ? (
        <>
          <div>
            <Label htmlFor="headline">Headline *</Label>
            <Input
              id="headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="subheadline">Subheadline</Label>
            <Input
              id="subheadline"
              value={subheadline}
              onChange={(e) => setSubheadline(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
          <div>
            <Label htmlFor="htmlContent">HTML Content *</Label>
            <Textarea
              id="htmlContent"
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              rows={10}
              required
              className="font-mono text-xs"
            />
          </div>
        </>
      ) : (
        <>
          <div>
            <Label htmlFor="file">File *</Label>
            <Input
              id="file"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
              accept={assetType === "covers" ? "image/*" : "*/*"}
            />
          </div>
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          {assetType === "covers" && (
            <div>
              <Label htmlFor="coverType">Cover Type</Label>
              <select
                id="coverType"
                value={coverType}
                onChange={(e) => setCoverType(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="ebook">eBook</option>
                <option value="paperback">Paperback</option>
                <option value="hardcover">Hardcover</option>
                <option value="social-media">Social Media</option>
              </select>
            </div>
          )}
        </>
      )}
      <div className="flex justify-end space-x-2">
        <Button type="submit" disabled={uploading}>
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

