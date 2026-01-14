"use client";

import { useState } from "react";
import Link from "next/link";
import { ImageCarousel } from "@/components/image-carousel";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Red_Hat_Display } from "next/font/google";

const redHatDisplay = Red_Hat_Display({
  subsets: ["latin"],
  variable: "--font-red-hat-display",
  weight: ["400", "500", "600", "700"],
});

// Placeholder images - replace with actual carousel images
// You can use book report images or marketing assets
const carouselImages = [
  "/api/uploads/precanned/uploads/wool_cover.jpg",
  "/api/uploads/precanned/uploads/beach_read.jpg",
  "/placeholder.svg",
  "/placeholder.svg",
  "/placeholder.svg",
];

export default function PurchaseUploadPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [error, setError] = useState("");

  const handlePurchase = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!email.trim()) {
      setShowEmailInput(true);
      return;
    }

    setLoading(true);
    setError("");
    
    try {
      const response = await fetch("/api/checkout/create-guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          featureType: "book-upload",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.url) {
          window.location.href = data.url;
        } else if (data.status === "completed" && data.redirectUrl) {
          window.location.href = data.redirectUrl;
        }
      } else {
        setError(data.error || "Failed to create checkout session. Please try again.");
        setLoading(false);
      }
    } catch (err) {
      console.error("Purchase error:", err);
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-[#FCFDFD] ${redHatDisplay.variable}`}>
      {/* Banner Section */}
      <header className="bg-white">
        <div className="max-w-7xl mx-auto px-4 pt-3 pb-5">
          <h1 
            className="text-[17px] font-normal text-[#2A2522] mb-0 pt-3 font-[family-name:var(--font-red-hat-display)]"
          >
            BookID Author Report
          </h1>
          <Link
            href="https://www.publishersweekly.com/pw/by-topic/international/international-book-news/article/99321-finnish-ai-co-aims-to-help-authors-with-market-analysis.html"
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-[#791529] text-white text-base py-2 px-0 mt-0 transition-opacity hover:opacity-90"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            <span className="block text-center">Featured By</span>
            <span className="block text-center">Publisher&apos;s</span>
            <span className="block text-center pb-5">Weekly</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center gap-8">
          {/* Carousel */}
          <div className="w-full cursor-pointer">
            <ImageCarousel images={carouselImages} autoPlay={true} interval={3000} />
          </div>

          {/* Buy Now Button Section */}
          <div className="flex flex-col items-center gap-4 w-full max-w-md">
            {showEmailInput && (
              <form onSubmit={handlePurchase} className="w-full space-y-3">
                <Input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full"
                  disabled={loading}
                />
                {error && (
                  <p className="text-sm text-red-600 text-center">{error}</p>
                )}
              </form>
            )}

            <button
              onClick={() => {
                if (!showEmailInput) {
                  setShowEmailInput(true);
                } else {
                  handlePurchase();
                }
              }}
              disabled={loading}
              className="relative inline-block px-8 py-5 rounded-2xl text-base font-normal text-[#2A2522] cursor-pointer transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(to bottom, rgb(225, 177, 55), rgb(210, 150, 45), rgb(178, 119, 52))",
                fontFamily: "Inter, sans-serif",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
              }}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Buy</span>
                    <span className="font-semibold">Now</span>
                  </div>
                  <p className="text-sm mt-1">50% Discount: GETLOST50</p>
                </div>
              )}
            </button>

            {/* Description Text */}
            <p 
              className="text-base text-[#2A2522] text-center max-w-2xl mt-2" 
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              For the first time, you can clearly identify who your book is for, what they care about, and how to reach them.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

