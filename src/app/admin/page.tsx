"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { Clock, CheckCircle, AlertCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

interface Report {
  id: string;
  bookVersionId: string;
  status: "requested" | "analyzing" | "completed";
  requestedAt: string;
  completedAt?: string;
  fileName?: string;
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
  latestReport?: Report;
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
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [uploadingReport, setUploadingReport] = useState(false);
  const [activeView, setActiveView] = useState<"books" | "users">("books");

  // Debug users data
  useEffect(() => {
    console.log("Users state updated:", users.length, "users");
    console.log("Active view:", activeView);
  }, [users, activeView]);

  // Check if user is admin
  useEffect(() => {
    if (isPending) return;

    if (!session) {
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
  }, [isPending, session]);

  const fetchData = async () => {
    try {
      // Fetch books, users and analytics in parallel
      const [booksRes, usersRes, analyticsRes] = await Promise.all([
        fetch("/api/admin/books"),
        fetch("/api/admin/users"),
        fetch("/api/admin/analytics")
      ]);

      if (booksRes.ok) {
        const booksData = await booksRes.json();
        setBooks(booksData);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        console.log("Users data fetched:", usersData);
        setUsers(usersData);
      } else {
        console.error("Failed to fetch users:", usersRes.status, await usersRes.text());
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

  const getReportStatusIcon = (status?: string) => {
    if (!status) return <XCircle className="w-4 h-4 text-gray-400" />;

    switch (status) {
      case "requested":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case "analyzing":
        return <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      default:
        return <XCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getReportStatusText = (status?: string) => {
    if (!status) return "Not requested";

    switch (status) {
      case "requested":
        return "Requested";
      case "analyzing":
        return "Analyzing";
      case "completed":
        return "Completed";
      default:
        return "Not requested";
    }
  };

  const handleReportUpload = async (bookId: string, file: File) => {
    setUploadingReport(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bookId", bookId);

      const response = await fetch(`/api/admin/books/${bookId}/report`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        await fetchData();
        alert("Report uploaded successfully");
      } else {
        alert("Failed to upload report");
      }
    } catch (error) {
      console.error("Failed to upload report:", error);
      alert("Failed to upload report");
    } finally {
      setUploadingReport(false);
    }
  };

  const handleUserRoleChange = async (userId: string, newRole: "user" | "admin") => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        await fetchData();
        alert(`User role updated to ${newRole}`);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update user role");
      }
    } catch (error) {
      console.error("Failed to update user role:", error);
      alert("Failed to update user role");
    }
  };

  const handleReportStatusChange = async (bookId: string, status: string) => {
    try {
      const response = await fetch(`/api/admin/books/${bookId}/report-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        // Update the selected book immediately
        if (selectedBook && selectedBook.id === bookId) {
          let updatedReport: Report | undefined;

          if (status === "not_requested") {
            updatedReport = undefined;
          } else if (selectedBook.latestReport) {
            // Update existing report
            updatedReport = {
              ...selectedBook.latestReport,
              status: status as "requested" | "analyzing" | "completed",
              completedAt: status === "completed" ? new Date().toISOString() : selectedBook.latestReport.completedAt,
            };
          } else {
            // Create new report
            updatedReport = {
              id: crypto.randomUUID(),
              bookVersionId: selectedBook.latestVersion?.id || "",
              status: status as "requested" | "analyzing" | "completed",
              requestedAt: new Date().toISOString(),
              completedAt: status === "completed" ? new Date().toISOString() : undefined,
            };
          }

          setSelectedBook({
            ...selectedBook,
            latestReport: updatedReport,
          });
        }
        await fetchData();
      }
    } catch (error) {
      console.error("Failed to update report status:", error);
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

  if (loading || isPending) {
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


        {/* View Switcher */}
        <div className="mb-6 flex space-x-2">
          <Button
            variant={activeView === "books" ? "default" : "outline"}
            onClick={() => {
              setActiveView("books");
              setCurrentPage(1);
            }}
            className={activeView === "books" ? "bg-orange-600 hover:bg-orange-700" : ""}
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Books
          </Button>
          <Button
            variant={activeView === "users" ? "default" : "outline"}
            onClick={() => {
              setActiveView("users");
              setCurrentPage(1);
            }}
            className={activeView === "users" ? "bg-orange-600 hover:bg-orange-700" : ""}
          >
            <Users className="w-4 h-4 mr-2" />
            Users
          </Button>
        </div>

        {/* Books/Users Table */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>
                  {activeView === "books" ? `All Books (${books.length})` : `All Users (${users.length})`}
                </CardTitle>
                <CardDescription>
                  {activeView === "books" ? "Manage all uploaded books and their processing status" : "View and manage user accounts"}
                </CardDescription>
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
            {activeView === "books" ? (
              // Books View
              books.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No books found
                </div>
              ) : (
                <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
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
                            <span>Digest Status</span>
                            <SortIcon field="status" />
                          </div>
                        </th>
                        <th className="text-left py-2 px-2">
                          <span>Report Status</span>
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
                        <th className="text-left py-2 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedBooks.map((book) => (
                        <tr key={book.id} className="border-b hover:bg-gray-50">
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
                            <td className="py-2 px-2">
                              <div className="flex items-center space-x-1">
                                {getReportStatusIcon(book.latestReport?.status)}
                                <span className="text-xs">
                                  {getReportStatusText(book.latestReport?.status)}
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
                            <td className="py-2 px-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedBook(book);
                                  setSheetOpen(true);
                                }}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </td>
                          </tr>
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
              )
            ) : (
              // Users View
              users.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No users found
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-4">User</th>
                          <th className="text-left py-2 px-4">Email</th>
                          <th className="text-left py-2 px-4">Role</th>
                          <th className="text-left py-2 px-4">Books</th>
                          <th className="text-left py-2 px-4">Auth</th>
                          <th className="text-left py-2 px-4">Verified</th>
                          <th className="text-left py-2 px-4">Created</th>
                          <th className="text-left py-2 px-4">Last Active</th>
                          <th className="text-left py-2 px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users
                          .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                          .map((user) => (
                            <tr key={user.id} className="border-b hover:bg-gray-50">
                              <td className="py-2 px-4">
                                <div className="flex items-center space-x-2">
                                  {user.image ? (
                                    <img
                                      src={user.image}
                                      alt={user.name || user.email}
                                      className="w-8 h-8 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                      <User className="w-4 h-4 text-gray-500" />
                                    </div>
                                  )}
                                  <span>{user.name || "-"}</span>
                                </div>
                              </td>
                              <td className="py-2 px-4">{user.email}</td>
                              <td className="py-2 px-4">
                                <span className={`px-2 py-0.5 text-xs rounded-full ${
                                  user.role === "super_admin"
                                    ? "bg-red-100 text-red-800"
                                    : user.role === "admin"
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}>
                                  {user.role === "super_admin" ? "Super Admin" : user.role || "user"}
                                </span>
                              </td>
                              <td className="py-2 px-4">{user.bookCount || 0}</td>
                              <td className="py-2 px-4">
                                <div className="flex items-center space-x-1">
                                  {user.hasGoogleAuth && (
                                    <div className="w-5 h-5 flex items-center justify-center" title="Google">
                                      <svg viewBox="0 0 24 24" className="w-4 h-4">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                      </svg>
                                    </div>
                                  )}
                                  {!user.hasGoogleAuth && user.password && (
                                    <span title="Email/Password">
                                      <Mail className="w-4 h-4 text-gray-500" />
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-4">
                                {user.emailVerified ? (
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-gray-400" />
                                )}
                              </td>
                              <td className="py-2 px-4 text-xs">
                                {(() => {
                                  if (!user.createdAt) return "-";
                                  try {
                                    // Handle both Date objects and timestamps
                                    const timestamp = user.createdAt instanceof Date
                                      ? user.createdAt.getTime()
                                      : typeof user.createdAt === 'number'
                                        ? user.createdAt * (user.createdAt < 10000000000 ? 1000 : 1)
                                        : Date.parse(user.createdAt);

                                    if (isNaN(timestamp)) return "-";

                                    return new Date(timestamp).toLocaleString('en-US', {
                                      year: 'numeric',
                                      month: '2-digit',
                                      day: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: false
                                    });
                                  } catch {
                                    return "-";
                                  }
                                })()}
                              </td>
                              <td className="py-2 px-4 text-xs">
                                {user.lastActivity
                                  ? new Date(user.lastActivity).toLocaleString('en-US', {
                                      year: 'numeric',
                                      month: '2-digit',
                                      day: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: false
                                    })
                                  : "-"}
                              </td>
                              <td className="py-2 px-4">
                                {session?.user?.role === "super_admin" && user.role !== "super_admin" ? (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <MoreHorizontal className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {user.role === "admin" ? (
                                        <DropdownMenuItem
                                          onClick={() => handleUserRoleChange(user.id, "user")}
                                          className="text-orange-600"
                                        >
                                          <UserX className="w-4 h-4 mr-2" />
                                          Demote to User
                                        </DropdownMenuItem>
                                      ) : (
                                        <DropdownMenuItem
                                          onClick={() => handleUserRoleChange(user.id, "admin")}
                                          className="text-blue-600"
                                        >
                                          <Shield className="w-4 h-4 mr-2" />
                                          Promote to Admin
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                ) : session?.user?.role === "admin" && user.role === "user" ? (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <MoreHorizontal className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={() => handleUserRoleChange(user.id, "admin")}
                                        className="text-blue-600"
                                      >
                                        <Shield className="w-4 h-4 mr-2" />
                                        Promote to Admin
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Users Pagination */}
                  {Math.ceil(users.length / itemsPerPage) > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-gray-600">
                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, users.length)} of {users.length} users
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
                          {Array.from({ length: Math.min(5, Math.ceil(users.length / itemsPerPage)) }, (_, i) => {
                            const totalUserPages = Math.ceil(users.length / itemsPerPage);
                            let pageNum;
                            if (totalUserPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalUserPages - 2) {
                              pageNum = totalUserPages - 4 + i;
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
                          onClick={() => setCurrentPage(Math.min(Math.ceil(users.length / itemsPerPage), currentPage + 1))}
                          disabled={currentPage === Math.ceil(users.length / itemsPerPage)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )
            )}
          </CardContent>
        </Card>

        {/* Book Details Sheet */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="right" className="w-[65vw] sm:w-[65vw] sm:max-w-[65vw] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-xl truncate max-w-full" title={selectedBook?.title}>
                {selectedBook?.title}
              </SheetTitle>
              <SheetDescription>
                Manage book details and reports
              </SheetDescription>
            </SheetHeader>

            {selectedBook && (
              <div className="space-y-6 mt-6">
                {/* Main content grid with cover image */}
                <div className="grid grid-cols-3 gap-6">
                  {/* Left column - Cover Image */}
                  <div className="col-span-1">
                    {selectedBook.coverImageUrl ? (
                      <img
                        src={selectedBook.coverImageUrl}
                        alt={selectedBook.title}
                        className="w-full rounded-lg shadow-lg object-contain max-h-[400px]"
                      />
                    ) : (
                      <div className="w-full h-[400px] bg-gray-100 rounded-lg flex items-center justify-center">
                        <BookOpen className="w-20 h-20 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Right columns - Book Info */}
                  <div className="col-span-2 space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Book Details</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start">
                          <span className="text-gray-600 flex-shrink-0">ID:</span>
                          <span className="ml-1 truncate" title={selectedBook.id}>{selectedBook.id}</span>
                        </div>
                        <div className="flex items-start">
                          <span className="text-gray-600 flex-shrink-0">Title:</span>
                          <span className="ml-1 truncate" title={selectedBook.title}>{selectedBook.title}</span>
                        </div>
                        <div className="flex items-start">
                          <span className="text-gray-600 flex-shrink-0">Description:</span>
                          <span className="ml-1 line-clamp-2">{selectedBook.description || "N/A"}</span>
                        </div>
                        <div><span className="text-gray-600">User:</span> {selectedBook.user.name || selectedBook.user.email}</div>
                        <div><span className="text-gray-600">Created:</span> {new Date(selectedBook.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* File Info and Processing Status */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-2">File Information</h3>
                    {selectedBook.latestVersion ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start">
                          <span className="text-gray-600 flex-shrink-0">File:</span>
                          <span className="ml-1 truncate" title={selectedBook.latestVersion.fileName}>
                            {selectedBook.latestVersion.fileName}
                          </span>
                        </div>
                        <div><span className="text-gray-600">Size:</span> {formatFileSize(selectedBook.latestVersion.fileSize)}</div>
                        <div><span className="text-gray-600">Uploaded:</span> {new Date(selectedBook.latestVersion.uploadedAt).toLocaleString()}</div>
                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.location.href = `/api/admin/books/${selectedBook.id}/download`}
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Download Book
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No file uploaded</p>
                    )}
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Processing Status</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-600">Digest:</span>
                        {getDigestStatusIcon(selectedBook.digestJob?.status)}
                        <span>{getDigestStatusText(selectedBook.digestJob?.status)}</span>
                      </div>
                      {selectedBook.digestJob?.author && (
                        <div><span className="text-gray-600">Author:</span> {selectedBook.digestJob.author}</div>
                      )}
                      {selectedBook.digestJob?.pages && (
                        <div><span className="text-gray-600">Pages:</span> {selectedBook.digestJob.pages}</div>
                      )}
                      {selectedBook.digestJob?.words && (
                        <div className="flex items-center space-x-1">
                          <span className="text-gray-600">Words:</span>
                          <span>{selectedBook.digestJob.words.toLocaleString()}</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <HelpCircle className="w-3 h-3 text-gray-400" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs text-xs">Word count may not be accurate for books that don't fit within OpenAI's context window</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      )}
                      {selectedBook.digestJob?.language && (
                        <div><span className="text-gray-600">Language:</span> {selectedBook.digestJob.language}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Summary Section */}
                {(selectedBook.digestJob?.brief || selectedBook.digestJob?.summary) && (
                  <div>
                    <h3 className="font-semibold mb-2">Summary</h3>
                    <div className="space-y-3">
                      {selectedBook.digestJob?.brief && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-1">Brief</h4>
                          <p className="text-sm text-gray-600">{selectedBook.digestJob.brief}</p>
                        </div>
                      )}
                      {selectedBook.digestJob?.summary && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-1">Full Summary</h4>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedBook.digestJob.summary}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Report Management */}
                <div>
                  <h3 className="font-semibold mb-2">Report Management</h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Status:</span>
                        {getReportStatusIcon(selectedBook.latestReport?.status)}
                        <span className="text-sm font-medium">{getReportStatusText(selectedBook.latestReport?.status)}</span>
                      </div>

                      <select
                        className="text-sm border rounded px-2 py-1"
                        value={selectedBook.latestReport?.status || "not_requested"}
                        onChange={(e) => handleReportStatusChange(selectedBook.id, e.target.value)}
                      >
                        <option value="not_requested">Not Requested</option>
                        <option value="requested">Requested</option>
                        <option value="analyzing">Analyzing</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>

                    {selectedBook.latestReport?.requestedAt && (
                      <div className="text-sm">
                        <span className="text-gray-600">Requested:</span> {new Date(selectedBook.latestReport.requestedAt).toLocaleString()}
                      </div>
                    )}

                    {selectedBook.latestReport?.completedAt && (
                      <div className="text-sm">
                        <span className="text-gray-600">Completed:</span> {new Date(selectedBook.latestReport.completedAt).toLocaleString()}
                      </div>
                    )}

                    <div className="flex items-center space-x-4">
                      <label className="inline-flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer">
                        <FileUp className="w-4 h-4 mr-2" />
                        {uploadingReport ? "Uploading..." : "Upload Report"}
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.html"
                          disabled={uploadingReport}
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleReportUpload(selectedBook.id, e.target.files[0]);
                            }
                          }}
                        />
                      </label>

                      {selectedBook.latestReport?.fileName && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.location.href = `/api/admin/books/${selectedBook.id}/report/download`}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Download Report
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </main>
    </div>
  );
}