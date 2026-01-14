"use client";

import { useState } from "react";
import Link from "next/link";
import { ImageCarousel } from "@/components/image-carousel";
import { Loader2 } from "lucide-react";
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
  const [error, setError] = useState("");

  const handlePurchase = async () => {
    setLoading(true);
    setError("");
    
    try {
      // Call API without email - Stripe will collect it
      const response = await fetch("/api/checkout/create-guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
            className="text-[17px] font-semibold text-[#2A2522] mb-0 pt-3 font-[family-name:var(--font-red-hat-display)]"
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
      <main className="flex flex-col items-center animate-fade-in" style={{ width: "382px", margin: "0 auto", padding: "0" }}>
        <div className="flex flex-col items-center gap-4 w-full">
          {/* Carousel */}
          <ImageCarousel images={carouselImages} autoPlay={true} interval={3000} />

          {/* Error Message */}
          {error && (
            <p className="text-sm text-red-600 text-center w-full">{error}</p>
          )}

          {/* Buy Now Button */}
          <button
            onClick={handlePurchase}
            disabled={loading}
            className="buy-button w-full py-5 px-8 text-center cursor-pointer active:scale-[0.98] transition-transform"
            style={{
              background: "linear-gradient(to bottom, rgb(225, 177, 55), rgb(210, 150, 45), rgb(178, 119, 52))",
              borderRadius: "16px",
              boxShadow: "rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.1) 0px 4px 6px -4px",
            }}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2 text-white">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </div>
            ) : (
              <div className="relative z-10">
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-[39px] font-bold text-white drop-shadow-sm">Buy</span>
                  <span className="text-[39px] font-bold text-white drop-shadow-sm">Now</span>
                </div>
                <p className="text-[15px] text-white/75 mt-1">50% Discount: GETLOST50</p>
              </div>
            )}
          </button>

          {/* Description Text */}
          <p 
            className="text-base text-[#2A2522] text-center" 
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            For the first time, you can clearly identify who your book is for, what they care about, and how to reach them.
          </p>
        </div>
      </main>
    </div>
  );
}

