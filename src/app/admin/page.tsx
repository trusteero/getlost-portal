"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText, Clock, CheckCircle, Upload, Bell, Eye, User, Calendar,
  Loader2, AlertCircle, Home, LogOut, ChevronDown, Settings
} from "lucide-react";
import { signOut } from "next-auth/react";

interface Report {
  id: string;
  status: "pending" | "analyzing" | "completed";
  requestedAt: string;
  startedAt?: string;
  completedAt?: string;
  analyzedBy?: string;
  bookVersion: {
    id: string;
    fileName: string;
    fileUrl: string;
    book: {
      id: string;
      title: string;
      user: {
        id: string;
        name: string;
        email: string;
      };
    };
  };
  notificationSent?: boolean;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "analyzing" | "completed">("all");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [uploadingResult, setUploadingResult] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Check if user is admin
  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    // Check if user is admin from environment variable
    const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",").map(e => e.trim()) || [];

    if (session?.user?.role !== "admin" && !adminEmails.includes(session?.user?.email || "")) {
      router.push("/dashboard");
      return;
    }

    fetchReports();
  }, [status, session]);

  const fetchReports = async () => {
    try {
      const response = await fetch("/api/admin/reports");
      if (response.ok) {
        const data = await response.json();
        setReports(data);
      }
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (reportId: string, newStatus: "analyzing" | "completed") => {
    try {
      const response = await fetch(`/api/admin/reports/${reportId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        await fetchReports();
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const handleUploadResult = async (reportId: string, file: File) => {
    setUploadingResult(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("reportId", reportId);

      const response = await fetch(`/api/admin/reports/${reportId}/upload`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        await fetchReports();
        setSelectedReport(null);
      }
    } catch (error) {
      console.error("Failed to upload result:", error);
    } finally {
      setUploadingResult(false);
    }
  };

  const handleNotifyUser = async (reportId: string, userId: string) => {
    setNotifying(true);
    try {
      const response = await fetch(`/api/admin/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId,
          userId,
          type: "report_ready",
        }),
      });

      if (response.ok) {
        await fetchReports();
      }
    } catch (error) {
      console.error("Failed to send notification:", error);
    } finally {
      setNotifying(false);
    }
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

  const filteredReports = reports.filter(report =>
    filter === "all" || report.status === filter
  );

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
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
              <Link href="/" className="text-2xl font-bold text-orange-600">
                Get Lost
              </Link>
              <span className="ml-4 text-gray-600">Admin Dashboard</span>
            </div>
            <div className="flex items-center space-x-3">
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  <Home className="w-4 h-4 mr-1" />
                  User Dashboard
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
                      {session?.user?.name?.charAt(0)?.toUpperCase() || session?.user?.email?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {session?.user?.name || session?.user?.email?.split('@')[0]}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown menu */}
                {dropdownOpen && (
                  <>
                    {/* Backdrop to close dropdown when clicking outside */}
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
                          onClick={() => {
                            setDropdownOpen(false);
                            signOut({ callbackUrl: "/" });
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
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Reports</p>
                  <p className="text-2xl font-bold">{reports.length}</p>
                </div>
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {reports.filter(r => r.status === "pending").length}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Analyzing</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {reports.filter(r => r.status === "analyzing").length}
                  </p>
                </div>
                <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-green-600">
                    {reports.filter(r => r.status === "completed").length}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-2 mb-6">
          {(["all", "pending", "analyzing", "completed"] as const).map((tab) => (
            <Button
              key={tab}
              variant={filter === tab ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(tab)}
              className={filter === tab ? "bg-orange-600 hover:bg-orange-700" : ""}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Button>
          ))}
        </div>

        {/* Reports Table */}
        <Card>
          <CardHeader>
            <CardTitle>Analysis Reports</CardTitle>
            <CardDescription>Manage and upload analysis reports for users</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredReports.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No reports found
              </div>
            ) : (
              <div className="space-y-4">
                {filteredReports.map((report) => (
                  <div
                    key={report.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedReport(report)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {getStatusIcon(report.status)}
                          <h3 className="font-semibold">{report.bookVersion.book.title}</h3>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                          <div className="flex items-center">
                            <User className="w-4 h-4 mr-1" />
                            {report.bookVersion.book.user.name || report.bookVersion.book.user.email}
                          </div>
                          <div className="flex items-center">
                            <FileText className="w-4 h-4 mr-1" />
                            {report.bookVersion.fileName}
                          </div>
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {new Date(report.requestedAt).toLocaleDateString()}
                          </div>
                          {report.notificationSent && (
                            <div className="flex items-center text-green-600">
                              <Bell className="w-4 h-4 mr-1" />
                              Notified
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex space-x-2 ml-4">
                        {report.status === "pending" && (
                          <Button
                            size="sm"
                            className="bg-orange-600 hover:bg-orange-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(report.id, "analyzing");
                            }}
                          >
                            Start Analysis
                          </Button>
                        )}

                        {report.status === "analyzing" && (
                          <label
                            className="inline-flex items-center px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Upload className="w-4 h-4 mr-1" />
                            Upload Result
                            <input
                              type="file"
                              className="hidden"
                              accept=".html,.pdf"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  handleUploadResult(report.id, e.target.files[0]);
                                }
                              }}
                            />
                          </label>
                        )}

                        {report.status === "completed" && !report.notificationSent && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNotifyUser(report.id, report.bookVersion.book.user.id);
                            }}
                            disabled={notifying}
                          >
                            {notifying ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Bell className="w-4 h-4 mr-1" />
                                Notify User
                              </>
                            )}
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(report.bookVersion.fileUrl, "_blank");
                          }}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View File
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}