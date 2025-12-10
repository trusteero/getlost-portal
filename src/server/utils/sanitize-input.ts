/**
 * Input sanitization utilities for XSS protection
 * Sanitizes user input before storing in database
 */

/**
 * Sanitize text input by removing HTML tags and escaping special characters
 * This prevents XSS attacks while preserving plain text content
 * 
 * @param input - The input string to sanitize
 * @param maxLength - Maximum allowed length (default: 10000)
 * @returns Sanitized string
 */
export function sanitizeText(input: string | null | undefined, maxLength: number = 10000): string | null {
  if (!input) {
    return null;
  }

  // Convert to string and trim
  let sanitized = String(input).trim();

  // Remove null bytes and other control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  // Remove HTML tags (basic protection)
  // This removes <script>, <iframe>, <object>, etc. and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  sanitized = sanitized.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');
  sanitized = sanitized.replace(/<link\b[^<]*(?:(?!<\/link>)<[^<]*)*<\/link>/gi, '');
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove all remaining HTML tags but preserve content
  sanitized = sanitized.replace(/<[^>]+>/g, '');

  // Decode HTML entities (to handle double-encoding attempts)
  sanitized = sanitized
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#x60;/g, '`')
    .replace(/&#x3D;/g, '=');

  // Escape remaining special characters that could be used in XSS
  sanitized = sanitized
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  // Normalize whitespace (collapse multiple spaces, preserve newlines)
  sanitized = sanitized.replace(/[ \t]+/g, ' ');
  sanitized = sanitized.replace(/\n\s*\n\s*\n+/g, '\n\n'); // Max 2 consecutive newlines

  // Trim again after processing
  sanitized = sanitized.trim();

  // Enforce maximum length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength).trim();
  }

  // Return null if empty after sanitization
  if (sanitized.length === 0) {
    return null;
  }

  return sanitized;
}

/**
 * Sanitize title/name input (shorter, more restrictive)
 * 
 * @param input - The input string to sanitize
 * @param maxLength - Maximum allowed length (default: 500)
 * @returns Sanitized string or null
 */
export function sanitizeTitle(input: string | null | undefined, maxLength: number = 500): string | null {
  if (!input) {
    return null;
  }

  let sanitized = sanitizeText(input, maxLength);
  
  if (!sanitized) {
    return null;
  }

  // For titles, remove newlines (titles should be single line)
  sanitized = sanitized.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

  return sanitized.length > 0 ? sanitized : null;
}

/**
 * Sanitize description/bio input (allows newlines, longer)
 * 
 * @param input - The input string to sanitize
 * @param maxLength - Maximum allowed length (default: 10000)
 * @returns Sanitized string or null
 */
export function sanitizeDescription(input: string | null | undefined, maxLength: number = 10000): string | null {
  return sanitizeText(input, maxLength);
}

/**
 * Sanitize summary input (allows newlines, longer)
 * 
 * @param input - The input string to sanitize
 * @param maxLength - Maximum allowed length (default: 50000)
 * @returns Sanitized string or null
 */
export function sanitizeSummary(input: string | null | undefined, maxLength: number = 50000): string | null {
  return sanitizeText(input, maxLength);
}

