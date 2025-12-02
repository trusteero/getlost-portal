import { describe, it, expect, vi } from "vitest";

// Set environment variables before any imports
process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./test.db";
process.env.NODE_ENV = "test";

// Mock file system operations
const mockReadFile = vi.fn();
const mockCopyFile = vi.fn();
const mockMkdir = vi.fn();
const mockAccess = vi.fn();
const mockReaddir = vi.fn();
const mockStat = vi.fn();

vi.mock("fs/promises", () => ({
  default: {
    readFile: (...args: any[]) => mockReadFile(...args),
    copyFile: (...args: any[]) => mockCopyFile(...args),
    mkdir: (...args: any[]) => mockMkdir(...args),
    access: (...args: any[]) => mockAccess(...args),
    readdir: (...args: any[]) => mockReaddir(...args),
    stat: (...args: any[]) => mockStat(...args),
  },
}));

// Mock the database module to avoid environment variable errors
vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("Precanned Content System - Package Discovery", () => {
  beforeEach(() => {
    // Setup default file system mock behaviors
    mockReadFile.mockImplementation(async (filePath: string) => {
      // Mock reading manifest.json
      if (filePath.includes("manifest.json")) {
        return JSON.stringify({
          books: [
            {
              key: "beach-read",
              title: "Beach Read by Emily Henry",
              uploadFileNames: ["BeachRead.pdf", "Beach Read by Emily Henry.pdf"],
              coverImageFileName: "beach_read.jpg",
              report: "Beach Read /Report/beach-final-standalone.html",
              preview: "Beach Read /Preview/beach-mini-standalone.html",
            },
            {
              key: "wool",
              title: "Wool by Hugh Howey",
              uploadFileNames: ["Wool by Hugh Howey.pdf"],
              coverImageFileName: "wool_cover.jpg",
              report: "Wool/Report/wool-final-standalone.html",
              preview: "Wool/Preview/wool-mini-standalone.html",
            },
          ],
        });
      }
      return Buffer.from("test file content");
    });

    mockCopyFile.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValue(["beach_read.jpg", "wool_cover.jpg"]);
    mockStat.mockResolvedValue({ size: 1024 });
  });

  describe("findPrecannedPackageByFilename", () => {
    it("should find package by matching filename", async () => {
      const { findPrecannedPackageByFilename } = await import("@/server/utils/precanned-content");
      
      const pkg = await findPrecannedPackageByFilename("BeachRead.pdf");
      
      expect(pkg).not.toBeNull();
      expect(pkg?.key).toBe("beach-read");
      expect(pkg?.title).toBe("Beach Read by Emily Henry");
    });

    it("should find package by alternative filename", async () => {
      const { findPrecannedPackageByFilename } = await import("@/server/utils/precanned-content");
      
      const pkg = await findPrecannedPackageByFilename("Wool by Hugh Howey.pdf");
      
      expect(pkg).not.toBeNull();
      expect(pkg?.key).toBe("wool");
    });

    it("should return null for non-matching filename", async () => {
      const { findPrecannedPackageByFilename } = await import("@/server/utils/precanned-content");
      
      const pkg = await findPrecannedPackageByFilename("UnknownBook.pdf");
      
      expect(pkg).toBeNull();
    });

    it("should return null for empty filename", async () => {
      const { findPrecannedPackageByFilename } = await import("@/server/utils/precanned-content");
      
      const pkg = await findPrecannedPackageByFilename("");
      
      expect(pkg).toBeNull();
    });
  });

  describe("findPrecannedPackageByKey", () => {
    it("should find package by key", async () => {
      const { findPrecannedPackageByKey } = await import("@/server/utils/precanned-content");
      
      const pkg = await findPrecannedPackageByKey("wool");
      
      expect(pkg).not.toBeNull();
      expect(pkg?.key).toBe("wool");
      expect(pkg?.title).toBe("Wool by Hugh Howey");
    });

    it("should find beach-read package by key", async () => {
      const { findPrecannedPackageByKey } = await import("@/server/utils/precanned-content");
      
      const pkg = await findPrecannedPackageByKey("beach-read");
      
      expect(pkg).not.toBeNull();
      expect(pkg?.key).toBe("beach-read");
    });

    it("should return null for invalid key", async () => {
      const { findPrecannedPackageByKey } = await import("@/server/utils/precanned-content");
      
      const pkg = await findPrecannedPackageByKey("invalid-key");
      
      expect(pkg).toBeNull();
    });
  });
});

// Note: Import integration tests are skipped due to complex database/file system mocking requirements
// These tests would require:
// 1. Proper database connection mocking
// 2. File system access for actual precanned content files
// 3. Integration test setup with real file paths
// 
// See TEST_CASES.md for full test coverage documentation
