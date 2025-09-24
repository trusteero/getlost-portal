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

    // Check admin status via API
    const checkAdmin = async () => {
      try {
        const response = await fetch("/api/admin/check");
        const data = await response.json();

        if (!data.isAdmin) {
          router.push("/dashboard");
          return;
        }

        fetchReports();
      } catch (error) {
        console.error("Failed to check admin status:", error);
        router.push("/dashboard");
      }
    };

    if (session) {
      checkAdmin();
    }
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

  const handleStatusChange = async (reportId: string, newStatus: "pending" | "analyzing" | "completed") => {
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
              <Link href="/" className="flex items-center space-x-2">
                <img src="/logo256.png" alt="Get Lost" className="h-8 w-8" />
                <span className="text-2xl font-bold text-orange-600">Get Lost</span>
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
            <CardTitle>Book Reports</CardTitle>
            <CardDescription>Manage and upload book reports for users</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredReports.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No reports found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Status</th>
                      <th className="text-left py-2 px-2">Book Title</th>
                      <th className="text-left py-2 px-2">Author</th>
                      <th className="text-left py-2 px-2">File</th>
                      <th className="text-left py-2 px-2">Submitted</th>
                      <th className="text-left py-2 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReports.map((report) => (
                      <tr key={report.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-2">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(report.status)}
                            <select
                              value={report.status}
                              onChange={(e) => {
                                if (e.target.value === "pending" || e.target.value === "analyzing" || e.target.value === "completed") {
                                  handleStatusChange(report.id, e.target.value as "analyzing" | "completed");
                                }
                              }}
                              className="text-xs border rounded px-2 py-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="pending">Pending</option>
                              <option value="analyzing">Analyzing</option>
                              <option value="completed">Completed</option>
                            </select>
                          </div>
                        </td>
                        <td className="py-3 px-2 font-medium">{report.bookVersion.book.title}</td>
                        <td className="py-3 px-2">{report.bookVersion.book.user.name || report.bookVersion.book.user.email?.split('@')[0]}</td>
                        <td className="py-3 px-2">
                          <div className="flex items-center space-x-1">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="truncate max-w-[150px]" title={report.bookVersion.fileName}>
                              {report.bookVersion.fileName}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          {new Date(report.requestedAt).toLocaleDateString()} {new Date(report.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center space-x-1">
                            {report.status === "analyzing" && (
                              <label className="inline-flex items-center px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer">
                                <Upload className="w-3 h-3 mr-1" />
                                Upload
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
                                className="h-7 px-2 text-xs"
                                onClick={() => handleNotifyUser(report.id, report.bookVersion.book.user.id)}
                                disabled={notifying}
                              >
                                {notifying ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <>
                                    <Bell className="w-3 h-3 mr-1" />
                                    Notify
                                  </>
                                )}
                              </Button>
                            )}

                            {report.notificationSent && (
                              <span className="text-xs text-green-600 flex items-center">
                                <Bell className="w-3 h-3 mr-1" />
                                Sent
                              </span>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => window.open(report.bookVersion.fileUrl, "_blank")}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              View
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}