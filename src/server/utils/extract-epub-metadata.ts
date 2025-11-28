import { promises as fs } from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { JSDOM } from "jsdom";

interface EpubMetadata {
  title?: string;
  author?: string;
  description?: string;
  coverImage?: Buffer;
  coverImageMimeType?: string;
  language?: string;
}

/**
 * Extract metadata from an EPUB file
 * EPUB files are ZIP archives containing:
 * - META-INF/container.xml (points to content.opf)
 * - OEBPS/content.opf or similar (contains metadata and manifest)
 * - Images and HTML files
 */
export async function extractEpubMetadata(
  fileBuffer: Buffer,
  fileName: string
): Promise<EpubMetadata> {
  const metadata: EpubMetadata = {};

  try {
    // EPUB files are ZIP archives
    const zip = new AdmZip(fileBuffer);
    const zipEntries = zip.getEntries();

    // Find container.xml to locate the OPF file
    const containerEntry = zipEntries.find(
      (entry) => entry.entryName === "META-INF/container.xml"
    );

    if (!containerEntry) {
      console.warn("[EPUB] No container.xml found in EPUB");
      return metadata;
    }

    const containerXml = containerEntry.getData().toString("utf-8");
    const containerDom = new JSDOM(containerXml, { contentType: "text/xml" });
    const containerDoc = containerDom.window.document;

    // Find the OPF file path
    const rootfileElement = containerDoc.querySelector("rootfile");
    const opfPath = rootfileElement?.getAttribute("full-path");

    if (!opfPath) {
      console.warn("[EPUB] No OPF file path found in container.xml");
      return metadata;
    }

    // Read the OPF file
    const opfEntry = zipEntries.find((entry) => entry.entryName === opfPath);

    if (!opfEntry) {
      console.warn(`[EPUB] OPF file not found: ${opfPath}`);
      return metadata;
    }

    const opfXml = opfEntry.getData().toString("utf-8");
    const opfDom = new JSDOM(opfXml, { contentType: "text/xml" });
    const opfDoc = opfDom.window.document;

    // Extract metadata from OPF
    const metadataElement = opfDoc.querySelector("metadata");
    if (metadataElement) {
      // Extract title
      const titleElement = metadataElement.querySelector("dc\\:title, title");
      if (titleElement) {
        metadata.title = titleElement.textContent?.trim() || undefined;
      }

      // Extract author/creator
      const creatorElement = metadataElement.querySelector(
        "dc\\:creator, creator"
      );
      if (creatorElement) {
        metadata.author = creatorElement.textContent?.trim() || undefined;
      }

      // Extract description
      const descriptionElement = metadataElement.querySelector(
        "dc\\:description, description"
      );
      if (descriptionElement) {
        metadata.description = descriptionElement.textContent?.trim() || undefined;
      }

      // Extract language
      const languageElement = metadataElement.querySelector(
        "dc\\:language, language"
      );
      if (languageElement) {
        metadata.language = languageElement.textContent?.trim() || undefined;
      }
    }

    // Find cover image
    // First, check for cover-image in manifest
    const manifestElement = opfDoc.querySelector("manifest");
    if (manifestElement) {
      const manifestItems = manifestElement.querySelectorAll("item");

      // Look for cover image in manifest
      let coverHref: string | null = null;
      let coverId: string | null = null;

      for (const item of manifestItems) {
        const id = item.getAttribute("id");
        const href = item.getAttribute("href");
        const mediaType = item.getAttribute("media-type");

        // Check for cover-image id or properties="cover-image"
        if (
          id?.toLowerCase().includes("cover") ||
          item.getAttribute("properties") === "cover-image"
        ) {
          coverId = id;
          coverHref = href || null;
          break;
        }

        // Also check media type for images
        if (mediaType?.startsWith("image/") && !coverHref) {
          coverId = id;
          coverHref = href || null;
        }
      }

      // If we found a cover reference, extract it
      if (coverHref) {
        // Resolve relative path from OPF location
        const opfDir = path.dirname(opfPath);
        const coverPath = path.join(opfDir, coverHref).replace(/\\/g, "/");

        const coverEntry = zipEntries.find(
          (entry) => entry.entryName === coverPath
        );

        if (coverEntry && !coverEntry.isDirectory) {
          const coverData = coverEntry.getData();
          metadata.coverImage = Buffer.from(coverData);

          // Determine MIME type from file extension or manifest
          const ext = path.extname(coverHref).toLowerCase();
          if (ext === ".jpg" || ext === ".jpeg") {
            metadata.coverImageMimeType = "image/jpeg";
          } else if (ext === ".png") {
            metadata.coverImageMimeType = "image/png";
          } else if (ext === ".gif") {
            metadata.coverImageMimeType = "image/gif";
          } else if (ext === ".webp") {
            metadata.coverImageMimeType = "image/webp";
          } else {
            metadata.coverImageMimeType = "image/jpeg"; // Default
          }

          console.log(
            `[EPUB] Extracted cover image: ${coverPath} (${metadata.coverImage.length} bytes)`
          );
        }
      }

      // Fallback: look for common cover image filenames
      if (!metadata.coverImage) {
        const commonCoverNames = [
          "cover.jpg",
          "cover.jpeg",
          "cover.png",
          "cover-image.jpg",
          "cover-image.png",
        ];

        for (const coverName of commonCoverNames) {
          const coverEntry = zipEntries.find(
            (entry) =>
              entry.entryName.toLowerCase().endsWith(coverName.toLowerCase()) &&
              !entry.isDirectory
          );

          if (coverEntry) {
            const coverData = coverEntry.getData();
            metadata.coverImage = Buffer.from(coverData);

            const ext = path.extname(coverName).toLowerCase();
            if (ext === ".jpg" || ext === ".jpeg") {
              metadata.coverImageMimeType = "image/jpeg";
            } else if (ext === ".png") {
              metadata.coverImageMimeType = "image/png";
            } else {
              metadata.coverImageMimeType = "image/jpeg";
            }

            console.log(
              `[EPUB] Found cover image by filename: ${coverEntry.entryName}`
            );
            break;
          }
        }
      }
    }

    console.log(`[EPUB] Extracted metadata:`, {
      title: metadata.title,
      author: metadata.author,
      hasCover: !!metadata.coverImage,
    });

    return metadata;
  } catch (error) {
    console.error(`[EPUB] Failed to extract metadata from ${fileName}:`, error);
    return metadata;
  }
}

