"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, FileText, X, Loader2, Image } from "lucide-react";

export default function NewBook() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [personalNotes, setPersonalNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // Get supported formats from environment
  const supportedFormats = process.env.NEXT_PUBLIC_SUPPORTED_FORMATS || ".doc,.docx,.pdf,.epub";
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
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    if (!formatList.includes(fileExtension)) {
      setError(`File format not supported. Please upload: ${formatList.join(", ")}`);
      return;
    }

    // Check file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      setError("File size must be less than 50MB");
      return;
    }

    setFile(file);
    setError("");
  };

  const removeFile = () => {
    setFile(null);
    setError("");
  };

  const handleCoverImage = (file: File) => {
    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      setError("Cover image must be an image file");
      return;
    }

    // Check file size (max 5MB for images)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError("Cover image must be less than 5MB");
      return;
    }

    setCoverImage(file);
    setError("");

    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setCoverImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeCoverImage = () => {
    setCoverImage(null);
    setCoverImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError("Please enter a book title");
      return;
    }

    if (!file) {
      setError("Please upload a manuscript file");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("personalNotes", personalNotes);
      formData.append("file", file);
      if (coverImage) {
        formData.append("coverImage", coverImage);
      }

      const response = await fetch("/api/books", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to create book");
      }

      const data = await response.json();
      router.push(`/dashboard/book/${data.bookId}`);
    } catch (error) {
      setError("Failed to create book. Please try again.");
      setUploading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-orange-600">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Add New Book</CardTitle>
            <CardDescription>
              Upload your manuscript and add details for analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex gap-6">
                {/* Left side - Title and Notes */}
                <div className="flex-1 space-y-4">
                  {/* Title */}
                  <div>
                    <Label htmlFor="title">Book Title *</Label>
                    <Input
                      id="title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter your book title"
                      className="mt-1"
                      disabled={uploading}
                    />
                  </div>

                  {/* Personal Notes */}
                  <div>
                    <Label htmlFor="notes">Personal Notes</Label>
                    <textarea
                      id="notes"
                      value={personalNotes}
                      onChange={(e) => setPersonalNotes(e.target.value)}
                      placeholder="Add any notes or context about your manuscript (optional)"
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                      rows={6}
                      disabled={uploading}
                    />
                  </div>
                </div>

                {/* Right side - Cover Image */}
                <div className="flex-shrink-0">
                  <Label htmlFor="coverImage">Cover Image</Label>
                  <div className="mt-1">
                    {coverImagePreview ? (
                      <div className="relative inline-block">
                        <img
                          src={coverImagePreview}
                          alt="Cover preview"
                          className="w-48 h-72 object-cover rounded-lg border"
                        />
                        {!uploading && (
                          <button
                            type="button"
                            onClick={removeCoverImage}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <label
                        className={`flex items-center justify-center w-48 h-72 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                          dragActive ? "border-orange-600 bg-orange-50" : "border-gray-300 hover:border-orange-600"
                        }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDragActive(false);
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            const file = e.dataTransfer.files[0];
                            if (file.type.startsWith('image/')) {
                              handleCoverImage(file);
                            }
                          }
                        }}
                      >
                        <div className="text-center">
                          <Image className="mx-auto h-12 w-12 text-gray-400" />
                          <p className="mt-2 text-sm text-gray-600">Add Cover</p>
                          <p className="text-xs text-gray-500 mt-1">Click or drag</p>
                        </div>
                        <input
                          id="coverImage"
                          type="file"
                          className="sr-only"
                          accept="image/*"
                          onChange={(e) => e.target.files && handleCoverImage(e.target.files[0])}
                          disabled={uploading}
                        />
                      </label>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Optional (max 5MB)</p>
                </div>
              </div>

              {/* File Upload */}
              <div>
                <Label>Manuscript File *</Label>
                <div className="mt-1">
                  <div
                    className={`relative border-2 border-dashed rounded-lg p-6 ${
                      dragActive ? "border-orange-600 bg-orange-50" : "border-gray-300"
                    } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    {file ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <FileText className="w-8 h-8 text-orange-600 mr-3" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{file.name}</p>
                            <p className="text-sm text-gray-500">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        {!uploading && (
                          <button
                            type="button"
                            onClick={removeFile}
                            className="text-gray-500 hover:text-red-600"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                        <p className="mt-2 text-sm text-gray-600">
                          <label
                            htmlFor="file-upload"
                            className="font-medium text-orange-600 hover:text-orange-500 cursor-pointer"
                          >
                            Click to upload
                          </label>
                          {" or drag and drop"}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Supported formats: {formatList.join(", ")} (max 50MB)
                        </p>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          className="sr-only"
                          accept={supportedFormats}
                          onChange={handleChange}
                          disabled={uploading}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 text-red-800 p-3 rounded-md text-sm">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-end space-x-3">
                <Link href="/dashboard">
                  <Button type="button" variant="outline" disabled={uploading}>
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="submit"
                  className="bg-orange-600 hover:bg-orange-700"
                  disabled={uploading || !title.trim() || !file}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    "Create Book"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}