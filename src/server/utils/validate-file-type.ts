/**
 * File type validation utilities
 * Validates both MIME type and file extension for security
 */

// Allowed file types for manuscript uploads
export const ALLOWED_MANUSCRIPT_TYPES = {
  mimeTypes: [
    "application/pdf",
    "application/msword", // .doc
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "text/plain", // .txt
    "application/epub+zip", // .epub
    "application/x-epub+zip", // .epub (alternative)
  ],
  extensions: [".pdf", ".doc", ".docx", ".txt", ".epub"],
};

// Allowed file types for cover images
export const ALLOWED_IMAGE_TYPES = {
  mimeTypes: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
  ],
  extensions: [".jpg", ".jpeg", ".png", ".webp", ".gif"],
};

// Allowed file types for admin asset uploads (ZIP files containing HTML/assets)
export const ALLOWED_ASSET_TYPES = {
  mimeTypes: [
    "application/zip",
    "application/x-zip-compressed",
    "application/x-zip",
  ],
  extensions: [".zip"],
};

// Allowed file types for report uploads (HTML or PDF)
export const ALLOWED_REPORT_TYPES = {
  mimeTypes: [
    "text/html",
    "application/pdf",
  ],
  extensions: [".html", ".pdf"],
};

export interface FileTypeValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate file type for manuscript uploads
 */
export function validateManuscriptFileType(file: File): FileTypeValidationResult {
  const fileName = file.name.toLowerCase();
  const fileExtension = fileName.substring(fileName.lastIndexOf("."));
  const mimeType = file.type.toLowerCase();

  // Check MIME type
  const isValidMimeType = ALLOWED_MANUSCRIPT_TYPES.mimeTypes.some(
    (allowedType) => mimeType === allowedType.toLowerCase()
  );

  // Check file extension
  const isValidExtension = ALLOWED_MANUSCRIPT_TYPES.extensions.some(
    (ext) => fileExtension === ext.toLowerCase()
  );

  // Both MIME type and extension must match (defense in depth)
  if (!isValidMimeType && !isValidExtension) {
    return {
      isValid: false,
      error: `Invalid file type. Allowed types: ${ALLOWED_MANUSCRIPT_TYPES.extensions.join(", ")}. Your file: ${fileExtension || "unknown type"}`,
    };
  }

  // If MIME type is missing or generic, rely on extension (some browsers don't set MIME type correctly)
  if (!mimeType || mimeType === "application/octet-stream") {
    if (!isValidExtension) {
      return {
        isValid: false,
        error: `Invalid file extension. Allowed extensions: ${ALLOWED_MANUSCRIPT_TYPES.extensions.join(", ")}. Your file: ${fileExtension || "unknown"}`,
      };
    }
    // Extension is valid, allow it (MIME type might be missing for valid files)
    return { isValid: true };
  }

  // If extension is missing, rely on MIME type
  if (!fileExtension || fileExtension === fileName) {
    if (!isValidMimeType) {
      return {
        isValid: false,
        error: `Invalid file type. Allowed MIME types: ${ALLOWED_MANUSCRIPT_TYPES.mimeTypes.join(", ")}. Your file: ${mimeType || "unknown type"}`,
      };
    }
    return { isValid: true };
  }

  // Both are present - both should be valid (defense in depth)
  if (isValidMimeType && isValidExtension) {
    return { isValid: true };
  }

  // One is valid but not both - be strict
  return {
    isValid: false,
    error: `File type mismatch. MIME type: ${mimeType}, Extension: ${fileExtension}. Both must match allowed types.`,
  };
}

/**
 * Validate file type for cover image uploads
 */
export function validateImageFileType(file: File): FileTypeValidationResult {
  const fileName = file.name.toLowerCase();
  const fileExtension = fileName.substring(fileName.lastIndexOf("."));
  const mimeType = file.type.toLowerCase();

  // Check MIME type
  const isValidMimeType = ALLOWED_IMAGE_TYPES.mimeTypes.some(
    (allowedType) => mimeType === allowedType.toLowerCase()
  );

  // Check file extension
  const isValidExtension = ALLOWED_IMAGE_TYPES.extensions.some(
    (ext) => fileExtension === ext.toLowerCase()
  );

  // Both MIME type and extension must match
  if (!isValidMimeType && !isValidExtension) {
    return {
      isValid: false,
      error: `Invalid image type. Allowed types: ${ALLOWED_IMAGE_TYPES.extensions.join(", ")}. Your file: ${fileExtension || "unknown type"}`,
    };
  }

  // If MIME type is missing or generic, rely on extension
  if (!mimeType || mimeType === "application/octet-stream") {
    if (!isValidExtension) {
      return {
        isValid: false,
        error: `Invalid image extension. Allowed extensions: ${ALLOWED_IMAGE_TYPES.extensions.join(", ")}. Your file: ${fileExtension || "unknown"}`,
      };
    }
    return { isValid: true };
  }

  // If extension is missing, rely on MIME type
  if (!fileExtension || fileExtension === fileName) {
    if (!isValidMimeType) {
      return {
        isValid: false,
        error: `Invalid image type. Allowed MIME types: ${ALLOWED_IMAGE_TYPES.mimeTypes.join(", ")}. Your file: ${mimeType || "unknown type"}`,
      };
    }
    return { isValid: true };
  }

  // Both are present - both should be valid
  if (isValidMimeType && isValidExtension) {
    return { isValid: true };
  }

  return {
    isValid: false,
    error: `Image type mismatch. MIME type: ${mimeType}, Extension: ${fileExtension}. Both must match allowed types.`,
  };
}

/**
 * Validate file type for admin asset uploads (ZIP files)
 */
export function validateAssetFileType(file: File): FileTypeValidationResult {
  const fileName = file.name.toLowerCase();
  const fileExtension = fileName.substring(fileName.lastIndexOf("."));
  const mimeType = file.type.toLowerCase();

  // Check MIME type
  const isValidMimeType = ALLOWED_ASSET_TYPES.mimeTypes.some(
    (allowedType) => mimeType === allowedType.toLowerCase()
  );

  // Check file extension
  const isValidExtension = ALLOWED_ASSET_TYPES.extensions.some(
    (ext) => fileExtension === ext.toLowerCase()
  );

  // Both MIME type and extension must match
  if (!isValidMimeType && !isValidExtension) {
    return {
      isValid: false,
      error: `Invalid asset file type. Allowed types: ${ALLOWED_ASSET_TYPES.extensions.join(", ")}. Your file: ${fileExtension || "unknown type"}`,
    };
  }

  // If MIME type is missing or generic, rely on extension
  if (!mimeType || mimeType === "application/octet-stream") {
    if (!isValidExtension) {
      return {
        isValid: false,
        error: `Invalid asset extension. Allowed extensions: ${ALLOWED_ASSET_TYPES.extensions.join(", ")}. Your file: ${fileExtension || "unknown"}`,
      };
    }
    return { isValid: true };
  }

  // If extension is missing, rely on MIME type
  if (!fileExtension || fileExtension === fileName) {
    if (!isValidMimeType) {
      return {
        isValid: false,
        error: `Invalid asset type. Allowed MIME types: ${ALLOWED_ASSET_TYPES.mimeTypes.join(", ")}. Your file: ${mimeType || "unknown type"}`,
      };
    }
    return { isValid: true };
  }

  // Both are present - both should be valid
  if (isValidMimeType && isValidExtension) {
    return { isValid: true };
  }

  return {
    isValid: false,
    error: `Asset type mismatch. MIME type: ${mimeType}, Extension: ${fileExtension}. Both must match allowed types.`,
  };
}

/**
 * Validate file type for report uploads (HTML or PDF)
 */
export function validateReportFileType(file: File): FileTypeValidationResult {
  const fileName = file.name.toLowerCase();
  const fileExtension = fileName.substring(fileName.lastIndexOf("."));
  const mimeType = file.type.toLowerCase();

  // Check MIME type
  const isValidMimeType = ALLOWED_REPORT_TYPES.mimeTypes.some(
    (allowedType) => mimeType === allowedType.toLowerCase()
  );

  // Check file extension
  const isValidExtension = ALLOWED_REPORT_TYPES.extensions.some(
    (ext) => fileExtension === ext.toLowerCase()
  );

  // Both MIME type and extension must match
  if (!isValidMimeType && !isValidExtension) {
    return {
      isValid: false,
      error: `Invalid report file type. Allowed types: ${ALLOWED_REPORT_TYPES.extensions.join(", ")}. Your file: ${fileExtension || "unknown type"}`,
    };
  }

  // If MIME type is missing or generic, rely on extension
  if (!mimeType || mimeType === "application/octet-stream") {
    if (!isValidExtension) {
      return {
        isValid: false,
        error: `Invalid report extension. Allowed extensions: ${ALLOWED_REPORT_TYPES.extensions.join(", ")}. Your file: ${fileExtension || "unknown"}`,
      };
    }
    return { isValid: true };
  }

  // If extension is missing, rely on MIME type
  if (!fileExtension || fileExtension === fileName) {
    if (!isValidMimeType) {
      return {
        isValid: false,
        error: `Invalid report type. Allowed MIME types: ${ALLOWED_REPORT_TYPES.mimeTypes.join(", ")}. Your file: ${mimeType || "unknown type"}`,
      };
    }
    return { isValid: true };
  }

  // Both are present - both should be valid
  if (isValidMimeType && isValidExtension) {
    return { isValid: true };
  }

  return {
    isValid: false,
    error: `Report type mismatch. MIME type: ${mimeType}, Extension: ${fileExtension}. Both must match allowed types.`,
  };
}

/**
 * Validate file type for admin asset uploads (ZIP or HTML)
 * This is a combined validation for endpoints that accept both ZIP and HTML
 */
export function validateAssetOrHtmlFileType(file: File): FileTypeValidationResult {
  // First check if it's a valid asset (ZIP)
  const assetValidation = validateAssetFileType(file);
  if (assetValidation.isValid) {
    return { isValid: true };
  }

  // Then check if it's a valid HTML file
  const fileName = file.name.toLowerCase();
  const fileExtension = fileName.substring(fileName.lastIndexOf("."));
  const mimeType = file.type.toLowerCase();

  const isHtml = 
    (mimeType === "text/html" || fileExtension === ".html") &&
    (fileExtension === ".html" || mimeType === "text/html" || (!mimeType || mimeType === "application/octet-stream"));

  if (isHtml) {
    return { isValid: true };
  }

  return {
    isValid: false,
    error: `Invalid file type. Allowed types: ZIP files (containing HTML + assets) or standalone HTML files. Your file: ${fileExtension || "unknown type"}`,
  };
}

