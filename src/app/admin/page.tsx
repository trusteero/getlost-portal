"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText, Clock, CheckCircle, Upload, Bell, Eye, User, Calendar,
  Loader2, AlertCircle, Home, LogOut, ChevronDown, ChevronRight, Settings,
  RefreshCw, Users, TrendingUp, BookOpen, Image, Download
} from "lucide-react";
import { signOut } from "next-auth/react";

interface DigestJob {
  id: string;
  status: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  attempts: number;
  error?: string;
  brief?: string;
  summary?: string;
  title?: string;
  author?: string;
  pages?: number;
  words?: number;
  language?: string;
}

interface Book {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name?: string;
    email: string;
  };
  digestJob?: DigestJob;
  latestVersion?: {
    id: string;
    fileName: string;
    fileSize: number;
    uploadedAt: string;
  };
}

interface Analytics {
  newUsersToday: number;
  newUsersYesterday: number;
  dailyActiveUsers: number;
  totalUsers: number;
}

type SortField = "title" | "user" | "status" | "createdAt" | "updatedAt";
type SortDirection = "asc" | "desc";

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedBooks, setExpandedBooks] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

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

        fetchData();
      } catch (error) {
        console.error("Failed to check admin status:", error);
        router.push("/dashboard");
      }
    };

    if (session) {
      checkAdmin();
    }
  }, [status, session]);

  const fetchData = async () => {
    try {
      // Fetch books and analytics in parallel
      const [booksRes, analyticsRes] = await Promise.all([
        fetch("/api/admin/books"),
        fetch("/api/admin/analytics")
      ]);

      if (booksRes.ok) {
        const booksData = await booksRes.json();
        setBooks(booksData);
      }

      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setAnalytics(analyticsData);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshDigestStatus = async () => {
    setRefreshing(true);
    try {
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  };

  const toggleBookExpansion = (bookId: string) => {
    const newExpanded = new Set(expandedBooks);
    if (newExpanded.has(bookId)) {
      newExpanded.delete(bookId);
    } else {
      newExpanded.add(bookId);
    }
    setExpandedBooks(newExpanded);
  };

  const getDigestStatusIcon = (status?: string) => {
    if (!status) return <Clock className="w-4 h-4 text-gray-400" />;

    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case "processing":
        return <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getDigestStatusText = (status?: string) => {
    if (!status) return "No digest";

    switch (status) {
      case "pending":
        return "Pending";
      case "processing":
        return "Processing";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
      default:
        return status;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const sortedBooks = [...books].sort((a, b) => {
    let aValue: any, bValue: any;

    switch (sortField) {
      case "title":
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
        break;
      case "user":
        aValue = (a.user.name || a.user.email).toLowerCase();
        bValue = (b.user.name || b.user.email).toLowerCase();
        break;
      case "status":
        aValue = a.digestJob?.status || "none";
        bValue = b.digestJob?.status || "none";
        break;
      case "createdAt":
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
      case "updatedAt":
        aValue = new Date(a.updatedAt).getTime();
        bValue = new Date(b.updatedAt).getTime();
        break;
      default:
        return 0;
    }

    if (sortDirection === "asc") {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  const totalPages = Math.ceil(sortedBooks.length / itemsPerPage);
  const paginatedBooks = sortedBooks.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronDown className="w-3 h-3 text-gray-400" />;
    }
    return sortDirection === "asc" ? (
      <ChevronDown className="w-3 h-3 text-gray-600 rotate-180" />
    ) : (
      <ChevronDown className="w-3 h-3 text-gray-600" />
    );
  };

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
                          onClick={async () => {
                            setDropdownOpen(false);
                            await signOut({ redirect: false });
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
        {/* Analytics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Books</p>
                  <p className="text-2xl font-bold">{books.length}</p>
                </div>
                <BookOpen className="w-8 h-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">New Users Today</p>
                  <p className="text-2xl font-bold">
                    {analytics?.newUsersToday || 0}
                  </p>
                  {analytics && analytics.newUsersYesterday > 0 && (
                    <p className="text-xs text-gray-500">
                      {analytics.newUsersToday > analytics.newUsersYesterday ? "+" : ""}
                      {((analytics.newUsersToday - analytics.newUsersYesterday) / analytics.newUsersYesterday * 100).toFixed(0)}%
                    </p>
                  )}
                </div>
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Daily Active Users</p>
                  <p className="text-2xl font-bold">
                    {analytics?.dailyActiveUsers || 0}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold">
                    {analytics?.totalUsers || 0}
                  </p>
                </div>
                <Users className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>


        {/* Books Table */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>All Books ({books.length})</CardTitle>
                <CardDescription>Manage all uploaded books and their processing status</CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="text-sm border rounded px-2 py-1"
                >
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRefreshDigestStatus}
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
            </div>
          </CardHeader>
          <CardContent>
            {books.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No books found
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 w-8"></th>
                        <th className="text-left py-2 px-2 w-12">Cover</th>
                        <th
                          className="text-left py-2 px-2 cursor-pointer hover:bg-gray-50"
                          onClick={() => handleSort("title")}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Title</span>
                            <SortIcon field="title" />
                          </div>
                        </th>
                        <th
                          className="text-left py-2 px-2 cursor-pointer hover:bg-gray-50"
                          onClick={() => handleSort("user")}
                        >
                          <div className="flex items-center space-x-1">
                            <span>User</span>
                            <SortIcon field="user" />
                          </div>
                        </th>
                        <th
                          className="text-left py-2 px-2 cursor-pointer hover:bg-gray-50"
                          onClick={() => handleSort("status")}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Status</span>
                            <SortIcon field="status" />
                          </div>
                        </th>
                        <th
                          className="text-left py-2 px-2 cursor-pointer hover:bg-gray-50"
                          onClick={() => handleSort("createdAt")}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Created</span>
                            <SortIcon field="createdAt" />
                          </div>
                        </th>
                        <th
                          className="text-left py-2 px-2 cursor-pointer hover:bg-gray-50"
                          onClick={() => handleSort("updatedAt")}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Updated</span>
                            <SortIcon field="updatedAt" />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedBooks.map((book) => (
                        <React.Fragment key={book.id}>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="py-2 px-2">
                              <button
                                onClick={() => toggleBookExpansion(book.id)}
                                className="p-1 hover:bg-gray-200 rounded"
                              >
                                {expandedBooks.has(book.id) ? (
                                  <ChevronDown className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-500" />
                                )}
                              </button>
                            </td>
                            <td className="py-2 px-2">
                              {book.coverImageUrl ? (
                                <img
                                  src={book.coverImageUrl}
                                  alt={book.title}
                                  className="w-8 h-11 object-cover rounded"
                                />
                              ) : (
                                <div className="w-8 h-11 bg-gray-100 rounded flex items-center justify-center">
                                  <Image className="w-3 h-3 text-gray-400" />
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-2">
                              <div className="max-w-xs">
                                <div className="font-medium truncate">{book.title}</div>
                                {book.description && (
                                  <div className="text-xs text-gray-500 truncate">{book.description}</div>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-gray-600">
                              {book.user.name || book.user.email.split('@')[0]}
                            </td>
                            <td className="py-2 px-2">
                              <div className="flex items-center space-x-1">
                                {getDigestStatusIcon(book.digestJob?.status)}
                                <span className="text-xs">
                                  {getDigestStatusText(book.digestJob?.status)}
                                </span>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-xs text-gray-600">
                              {new Date(book.createdAt).toLocaleDateString()}<br/>
                              {new Date(book.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2 px-2 text-xs text-gray-600">
                              {new Date(book.updatedAt).toLocaleDateString()}<br/>
                              {new Date(book.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                          </tr>
                          {expandedBooks.has(book.id) && (
                            <tr>
                              <td colSpan={7} className="bg-gray-50 px-8 py-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {/* Book details */}
                                  <div>
                                    <h4 className="font-medium text-sm mb-2">Book Details</h4>
                                    <div className="space-y-1 text-xs">
                                      {book.digestJob?.author && (
                                        <div>
                                          <span className="text-gray-600">Author:</span> {book.digestJob.author}
                                        </div>
                                      )}
                                      {book.digestJob?.pages && (
                                        <div>
                                          <span className="text-gray-600">Pages:</span> {book.digestJob.pages}
                                        </div>
                                      )}
                                      {book.digestJob?.words && (
                                        <div>
                                          <span className="text-gray-600">Words:</span> {book.digestJob.words.toLocaleString()}
                                        </div>
                                      )}
                                      {book.digestJob?.language && (
                                        <div>
                                          <span className="text-gray-600">Language:</span> {book.digestJob.language}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* File info */}
                                  {book.latestVersion && (
                                    <div>
                                      <h4 className="font-medium text-sm mb-2">File Information</h4>
                                      <div className="space-y-1 text-xs">
                                        <div>
                                          <span className="text-gray-600">File:</span>
                                          <span className="ml-1 inline-block max-w-[200px] truncate align-bottom" title={book.latestVersion.fileName}>
                                            {book.latestVersion.fileName}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-gray-600">Size:</span> {formatFileSize(book.latestVersion.fileSize)}
                                        </div>
                                        <div>
                                          <span className="text-gray-600">Uploaded:</span> {new Date(book.latestVersion.uploadedAt).toLocaleString()}
                                        </div>
                                        <div className="mt-2">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs"
                                            onClick={() => window.location.href = `/api/admin/books/${book.id}/download`}
                                          >
                                            <Download className="w-3 h-3 mr-1" />
                                            Download
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Processing details */}
                                  <div>
                                    <h4 className="font-medium text-sm mb-2">Processing</h4>
                                    <div className="space-y-1 text-xs">
                                      {book.digestJob?.attempts && book.digestJob.attempts > 0 && (
                                        <div>
                                          <span className="text-gray-600">Attempts:</span> {book.digestJob.attempts}
                                        </div>
                                      )}
                                      {book.digestJob?.startedAt && (
                                        <div>
                                          <span className="text-gray-600">Started:</span> {new Date(book.digestJob.startedAt).toLocaleString()}
                                        </div>
                                      )}
                                      {book.digestJob?.completedAt && (
                                        <div>
                                          <span className="text-gray-600">Completed:</span> {new Date(book.digestJob.completedAt).toLocaleString()}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Brief */}
                                {book.digestJob?.brief && (
                                  <div className="mt-4">
                                    <h4 className="font-medium text-sm mb-1">Brief</h4>
                                    <p className="text-xs text-gray-600">{book.digestJob.brief}</p>
                                  </div>
                                )}

                                {/* Error */}
                                {book.digestJob?.error && (
                                  <div className="mt-4 p-2 bg-red-50 rounded">
                                    <span className="text-red-600 text-xs">Error: {book.digestJob.error}</span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-gray-600">
                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, books.length)} of {books.length} books
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <Button
                              key={pageNum}
                              size="sm"
                              variant={currentPage === pageNum ? "default" : "outline"}
                              onClick={() => setCurrentPage(pageNum)}
                              className={currentPage === pageNum ? "bg-orange-600 hover:bg-orange-700" : ""}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}