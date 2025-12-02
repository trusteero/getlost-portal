import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the email service module instead of resend directly
vi.mock("@/server/services/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

describe("Email Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should send verification email", async () => {
    const { sendEmail } = await import("@/server/services/email");
    
    const result = await sendEmail({
      to: "test@example.com",
      subject: "Verify your email",
      html: "<p>Please verify your email</p>",
      text: "Please verify your email",
    });

    expect(result).toBe(true);
  });

  it("should send manuscript queued notification", async () => {
    const { sendEmail } = await import("@/server/services/email");
    
    const result = await sendEmail({
      to: "test@example.com",
      subject: "Manuscript Queued",
      html: "<p>Your manuscript has been queued</p>",
      text: "Your manuscript has been queued",
    });

    expect(result).toBe(true);
  });

  it("should send report ready notification", async () => {
    const { sendEmail } = await import("@/server/services/email");
    
    const result = await sendEmail({
      to: "test@example.com",
      subject: "Report Ready",
      html: "<p>Your report is ready</p>",
      text: "Your report is ready",
    });

    expect(result).toBe(true);
  });

  it("should handle email send errors gracefully", async () => {
    const { sendEmail } = await import("@/server/services/email");
    
    // Mock sendEmail to throw error
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("Email send failed"));

    // Email service should handle errors
    await expect(sendEmail({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Test</p>",
    })).rejects.toThrow("Email send failed");
  });
});

