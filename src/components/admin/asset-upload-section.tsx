"use client";

import { FileUp, XCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AssetItem {
  id: string;
  title?: string;
  createdAt?: string | Date | number;
  requestedAt?: string | Date | number;
  completedAt?: string | Date | number;
  viewedAt?: string | Date | number | null;
  isActive?: boolean;
  isPrimary?: boolean;
  adminNotes?: string | object; // For reports
}

interface AssetUploadSectionProps {
  title: string;
  assetType: "report" | "preview-report" | "marketing-assets" | "covers" | "landing-page";
  items: AssetItem[];
  isUploading: boolean;
  onUpload: (file: File) => void;
  onSetActive?: (itemId: string) => void;
  onDelete: (itemId: string) => void;
  activeLabel?: string; // "Active" or "Primary"
  uploadButtonColor?: string; // Tailwind color class
}

export function AssetUploadSection({
  title,
  assetType,
  items,
  isUploading,
  onUpload,
  onSetActive,
  onDelete,
  activeLabel = "Active",
  uploadButtonColor = "bg-blue-600 hover:bg-blue-700",
}: AssetUploadSectionProps) {
  const getUploadDate = (item: AssetItem): Date | null => {
    const dateValue = item.createdAt || item.requestedAt || item.completedAt;
    if (!dateValue) return null;
    
    // Handle different date formats
    if (typeof dateValue === 'string') {
      return new Date(dateValue);
    } else if (typeof dateValue === 'number') {
      return new Date(dateValue * 1000); // Assume Unix timestamp in seconds
    } else if (dateValue instanceof Date) {
      return dateValue;
    }
    return null;
  };

  const getDisplayTitle = (item: AssetItem, index: number) => {
    if (item.title) return item.title;
    const uploadDate = getUploadDate(item);
    const dateStr = uploadDate ? uploadDate.toLocaleDateString() : '';
    if (assetType === "report") return `Report ${dateStr}`;
    if (assetType === "preview-report") return `Preview Report ${dateStr}`;
    if (assetType === "marketing-assets") return `Marketing Asset ${dateStr}`;
    if (assetType === "covers") return `Cover Gallery ${dateStr}`;
    if (assetType === "landing-page") return `Landing Page ${dateStr}`;
    return `${title} ${index + 1}`;
  };

  const isActive = (item: AssetItem) => {
    // For reports, check adminNotes.isActive
    if (assetType === "report" || assetType === "preview-report") {
      if (item.adminNotes) {
        try {
          const notes = typeof item.adminNotes === 'string' ? JSON.parse(item.adminNotes) : item.adminNotes;
          return notes.isActive === true;
        } catch {
          return false;
        }
      }
      return false;
    }
    // For other assets, use isActive or isPrimary
    return item.isActive !== undefined ? item.isActive : item.isPrimary !== undefined ? item.isPrimary : false;
  };

  return (
    <div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <div className="space-y-4">
        {/* Upload Button */}
        <div className="flex items-center justify-start">
          <label className={`inline-flex items-center px-4 py-2 text-sm font-medium ${uploadButtonColor} text-white rounded cursor-pointer hover:opacity-90 transition-opacity`}>
            <FileUp className="w-4 h-4 mr-2" />
            {isUploading ? "Uploading..." : "Upload"}
            <input
              type="file"
              className="hidden"
              accept=".zip,.html"
              disabled={isUploading}
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  onUpload(e.target.files[0]);
                  e.target.value = "";
                }
              }}
            />
          </label>
        </div>
        <p className="text-xs text-gray-500">
          Upload a ZIP file (HTML + images/videos) or a standalone HTML file. 
          Images will be automatically bundled into the HTML.
        </p>

        {/* Upload History */}
        {items.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Upload History:</h4>
            <div className="space-y-2">
              {items.map((item, index) => {
                const uploadDate = getUploadDate(item);
                const displayTitle = getDisplayTitle(item, index);
                const itemIsActive = isActive(item);

                return (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <div className="text-sm font-medium truncate">{displayTitle}</div>
                        {itemIsActive && (
                          <div title={activeLabel}>
                            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        <div>Uploaded: {uploadDate ? uploadDate.toLocaleString() : "Unknown"}</div>
                        {item.viewedAt && (() => {
                          const viewedDate = typeof item.viewedAt === 'string' 
                            ? new Date(item.viewedAt)
                            : typeof item.viewedAt === 'number'
                            ? new Date(item.viewedAt * 1000)
                            : item.viewedAt instanceof Date
                            ? item.viewedAt
                            : null;
                          return viewedDate ? <div>Viewed: {viewedDate.toLocaleString()}</div> : null;
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      {/* Version Selector */}
                      {onSetActive && !itemIsActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onSetActive(item.id)}
                          title={`Set as ${activeLabel.toLowerCase()}`}
                        >
                          Set {activeLabel}
                        </Button>
                      )}
                      {itemIsActive && (
                        <span className="text-xs text-green-600 font-medium px-2">
                          {activeLabel}
                        </span>
                      )}
                      {!onSetActive && itemIsActive && (
                        <span className="text-xs text-green-600 font-medium px-2">
                          {activeLabel}
                        </span>
                      )}
                      {/* Delete Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete this ${title.toLowerCase()}?`)) {
                            onDelete(item.id);
                          }
                        }}
                        title="Delete"
                      >
                        <XCircle className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

