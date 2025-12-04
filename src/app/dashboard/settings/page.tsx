"use client";

import { useState, useEffect } from "react";
import { useSession, updateUser } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, User, Mail, Shield, Save, Loader2, Trash2, AlertTriangle, CreditCard, Upload } from "lucide-react";

// Force dynamic rendering since we need auth check
export const dynamic = 'force-dynamic';

export default function Settings() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deletingBooks, setDeletingBooks] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [credits, setCredits] = useState<{
    uploadPermissionsPurchased: number;
    booksUploaded: number;
    totalSpent: number;
  } | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(false);

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    } else if (session?.user) {
      setFormData(prev => ({
        ...prev,
        name: session.user.name || "",
        email: session.user.email || "",
      }));
      fetchCredits();
    }
  }, [session, isPending]);

  const fetchCredits = async () => {
    setLoadingCredits(true);
    try {
      const response = await fetch("/api/user/credits");
      if (response.ok) {
        const data = await response.json();
        setCredits({
          uploadPermissionsPurchased: data.uploadPermissionsPurchased || 0,
          booksUploaded: data.booksUploaded || 0,
          totalSpent: data.totalSpent || 0,
        });
      }
    } catch (error) {
      console.error("Failed to fetch credits:", error);
    } finally {
      setLoadingCredits(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSaved(false);

    // Validate passwords if changing
    if (formData.newPassword) {
      if (formData.newPassword.length < 8) {
        setErrors({ newPassword: "Password must be at least 8 characters" });
        return;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        setErrors({ confirmPassword: "Passwords do not match" });
        return;
      }
      if (!formData.currentPassword) {
        setErrors({ currentPassword: "Current password is required to set a new password" });
        return;
      }
    }

    setLoading(true);
    try {
      const response = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          currentPassword: formData.currentPassword || undefined,
          newPassword: formData.newPassword || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.error) {
          setErrors({ general: data.error });
        }
        return;
      }

      // Update session with new name
      await updateUser({ name: formData.name });

      // Clear password fields
      setFormData(prev => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      setErrors({ general: "Failed to save settings" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllBooks = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setDeletingBooks(true);
    setErrors({});
    
    try {
      const response = await fetch("/api/user/books", {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        setErrors({ deleteBooks: data.error || "Failed to delete book data" });
        setShowDeleteConfirm(false);
        return;
      }

      const data = await response.json();
      setShowDeleteConfirm(false);
      
      // Force full page reload to reset all state and show "Welcome" message
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1000);
    } catch (error) {
      setErrors({ deleteBooks: "Failed to delete book data" });
      setShowDeleteConfirm(false);
    } finally {
      setDeletingBooks(false);
    }
  };

  if (isPending) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <>
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-3">
            <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-orange-600 text-sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
          <p className="text-gray-600 mt-2">Manage your account information and security</p>
        </div>

        <div className="grid gap-6">
          {/* Credits/Uploads Information */}
          <Card>
            <CardHeader>
              <CardTitle>Credits & Uploads</CardTitle>
              <CardDescription>Your account credits and upload permissions</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCredits ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : credits !== null ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Upload className="w-5 h-5 text-emerald-600" />
                      <h3 className="font-semibold text-emerald-900">Upload Permissions</h3>
                    </div>
                    <p className="text-3xl font-bold text-emerald-600">{credits.uploadPermissionsPurchased}</p>
                    <p className="text-sm text-emerald-700 mt-1">
                      {credits.uploadPermissionsPurchased === 1 ? "Permission purchased" : "Permissions purchased"}
                    </p>
                  </div>
                  
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Upload className="w-5 h-5 text-purple-600" />
                      <h3 className="font-semibold text-purple-900">Books Uploaded</h3>
                    </div>
                    <p className="text-3xl font-bold text-purple-600">{credits.booksUploaded}</p>
                    <p className="text-sm text-purple-700 mt-1">
                      {credits.booksUploaded === 1 ? "Book uploaded" : "Books uploaded"}
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <CreditCard className="w-5 h-5 text-blue-600" />
                      <h3 className="font-semibold text-blue-900">Total Spent</h3>
                    </div>
                    <p className="text-3xl font-bold text-blue-600">${credits.totalSpent.toFixed(2)}</p>
                    <p className="text-sm text-blue-700 mt-1">
                      Total funds spent on upload permissions
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Unable to load credits information</p>
              )}
            </CardContent>
          </Card>

          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your account details</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="name">
                      <User className="w-4 h-4 inline mr-1" />
                      Name
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">
                      <Mail className="w-4 h-4 inline mr-1" />
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      disabled
                      className="mt-1 bg-gray-50"
                    />
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>
                </div>

                {(session?.user as any)?.role && (
                  <div>
                    <Label>
                      <Shield className="w-4 h-4 inline mr-1" />
                      Account Role
                    </Label>
                    <div className="mt-1 px-3 py-2 bg-gray-50 rounded-md">
                      <span className="text-sm font-medium capitalize">{(session?.user as any)?.role}</span>
                    </div>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password to keep your account secure</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={formData.currentPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                    className="mt-1"
                  />
                  {errors.currentPassword && (
                    <p className="text-sm text-red-600 mt-1">{errors.currentPassword}</p>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={formData.newPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                      className="mt-1"
                    />
                    {errors.newPassword && (
                      <p className="text-sm text-red-600 mt-1">{errors.newPassword}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="mt-1"
                    />
                    {errors.confirmPassword && (
                      <p className="text-sm text-red-600 mt-1">{errors.confirmPassword}</p>
                    )}
                  </div>
                </div>

                {/* Error/Success Messages */}
                {errors.general && (
                  <div className="bg-red-50 text-red-800 p-3 rounded-md text-sm">
                    {errors.general}
                  </div>
                )}

                {saved && (
                  <div className="bg-green-50 text-green-800 p-3 rounded-md text-sm">
                    Settings saved successfully!
                  </div>
                )}

                {/* Save Button */}
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    className="bg-orange-600 hover:bg-orange-700"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Delete All Book Data */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
              <CardDescription>Permanently delete all your book data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-red-900 mb-2">
                        Delete All Book Data
                      </h3>
                      <p className="text-sm text-red-800 mb-3">
                        This will permanently delete all your manuscripts, reports, marketing assets, 
                        book covers, landing pages, and all related data. This action cannot be undone.
                      </p>
                      {showDeleteConfirm && (
                        <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded">
                          <p className="text-sm font-medium text-red-900 mb-2">
                            Are you sure you want to delete all your book data?
                          </p>
                          <p className="text-xs text-red-700">
                            This action is permanent and cannot be undone.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {errors.deleteBooks && (
                  <div className="bg-red-50 text-red-800 p-3 rounded-md text-sm">
                    {errors.deleteBooks}
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  {showDeleteConfirm && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setErrors({});
                      }}
                      disabled={deletingBooks}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAllBooks}
                    disabled={deletingBooks}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {deletingBooks ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        {showDeleteConfirm ? "Confirm Delete All Books" : "Delete All Book Data"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}