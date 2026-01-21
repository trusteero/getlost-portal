"use client";

import { useState } from "react";
import Link from "next/link";
import { ImageCarousel } from "@/components/image-carousel";
import { Loader2, ArrowUpRight } from "lucide-react";
import { Red_Hat_Display } from "next/font/google";

const redHatDisplay = Red_Hat_Display({
  subsets: ["latin"],
  variable: "--font-red-hat-display",
  weight: ["400", "500", "600", "700"],
});

// Mobile carousel images
const mobileCarouselImages = [
  "/Carousel1.png",
  "/Carousel2.png",
  "/Carousel3.png",
  "/Carousel4.png",
  "/Carousel5.png",
];

// Desktop carousel images
const desktopCarouselImages = [
  "/DesktopCarousel1.png",
  "/DesktopCarousel2.png",
  "/DesktopCarousel3.png",
  "/DesktopCarousel4.png",
  "/DesktopCarousel5.png",
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
    <>
      {/* Mobile Layout - Original Design */}
      <div className={`lg:hidden min-h-screen bg-[#FCFDFD] ${redHatDisplay.variable}`}>
        {/* Banner Section */}
        <header className="bg-white">
          <div className="max-w-7xl mx-auto px-4 pt-3 pb-5">
            <div className="flex items-start justify-between max-w-md mx-auto">
              {/* Left: Title */}
              <h1 
                className="text-[17px] font-semibold text-[#2A2522] mb-0 pt-3 font-[family-name:var(--font-red-hat-display)]"
              >
                myStory DNA report
              </h1>
              
              {/* Right: Featured Banner - Pennant/Ribbon Shape */}
              <Link
                href="https://www.publishersweekly.com/pw/by-topic/international/international-book-news/article/99321-finnish-ai-co-aims-to-help-authors-with-market-analysis.html"
                target="_blank"
                rel="noopener noreferrer"
                className="relative bg-[#791529] text-white transition-opacity hover:opacity-90 inline-block"
                style={{ 
                  fontFamily: "Inter, sans-serif",
                  clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 12px), 50% 100%, 0 calc(100% - 12px))",
                  padding: "8px 16px 16px 16px",
                }}
              >
                <span className="block text-xs leading-tight text-center">Featured By</span>
                <span className="block text-sm font-bold leading-tight text-center">Publisher&apos;s</span>
                <span className="block text-sm font-bold leading-tight text-center">Weekly</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-4 sm:py-8">
          <div className="flex flex-col items-center gap-6 sm:gap-8 w-full">
            {/* Carousel - Same width as button */}
            <div className="w-full max-w-md">
              <ImageCarousel images={mobileCarouselImages} autoPlay={true} interval={3000} />
            </div>

            {/* Buy Now Button Section - Same width as carousel */}
            <div className="flex flex-col items-center gap-4 w-full max-w-md">
              {/* Error Message */}
              {error && (
                <p className="text-sm text-red-600 text-center w-full">{error}</p>
              )}

              {/* Buy Now Button */}
              <button
                onClick={handlePurchase}
                disabled={loading}
                className="buy-button w-full max-w-md py-6 sm:py-8 px-6 sm:px-8 text-center cursor-pointer active:scale-[0.98] transition-transform"
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
                      <span className="text-4xl sm:text-5xl md:text-6xl font-bold text-white drop-shadow-sm">Buy</span>
                      <span className="text-4xl sm:text-5xl md:text-6xl font-bold text-white drop-shadow-sm">Now</span>
                    </div>
                  </div>
                )}
              </button>

              {/* Description Text */}
              <p 
                className="text-base text-[#2A2522] text-center" 
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                For the <b>first time</b>, you can clearly identify who your book is for, what they care about, and how to reach them.
              </p>
            </div>
          </div>
        </main>
      </div>

      {/* Desktop Layout - New Design */}
      <div className="hidden lg:block min-h-screen bg-white relative overflow-hidden">
        {/* Background decorative orange shapes */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -left-32 top-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -right-32 top-1/3 w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-3xl"></div>
        </div>

        {/* Header Section */}
        <header className="relative z-10 bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex items-center justify-between h-20">
              {/* Left: Logo */}
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-black">GET LOST</span>
                {/* Logo icon placeholder - replace with actual logo image if available */}
                <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 via-orange-500 to-blue-500 rounded"></div>
              </div>
              
              {/* Right: Featured by Publishers Weekly */}
              <Link
                href="https://www.publishersweekly.com/pw/by-topic/international/international-book-news/article/99321-finnish-ai-co-aims-to-help-authors-with-market-analysis.html"
                target="_blank"
                rel="noopener noreferrer"
                className="relative bg-[#791529] text-white transition-opacity hover:opacity-90 inline-block"
                style={{ 
                  fontFamily: "Inter, sans-serif",
                  clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 12px), 50% 100%, 0 calc(100% - 12px))",
                  padding: "8px 16px 16px 16px",
                }}
              >
                <span className="block text-xs leading-tight text-center">Featured By</span>
                <span className="block text-sm font-bold leading-tight text-center">Publisher&apos;s</span>
                <span className="block text-sm font-bold leading-tight text-center">Weekly</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-12 lg:py-20">
          <div className="flex flex-col items-center gap-12 lg:gap-16">
            {/* Main Headline */}
            <h1 className="text-5xl lg:text-7xl font-bold text-black text-center max-w-4xl">
              Publish with intent.
            </h1>

            {/* Carousel Section */}
            <div className="w-full max-w-5xl lg:max-w-6xl">
              <div className="relative">
                <ImageCarousel images={desktopCarouselImages} autoPlay={true} interval={3000} />
              </div>
            </div>

            {/* Tagline */}
            <p className="text-3xl lg:text-4xl font-bold text-black text-center max-w-3xl">
              Gain insights that convert into book sales.
            </p>

            {/* Error Message */}
            {error && (
              <p className="text-sm text-red-600 text-center max-w-md">{error}</p>
            )}

            {/* Buy Now Button */}
            <button
              onClick={handlePurchase}
              disabled={loading}
              className="group relative bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-4 rounded-lg transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>Buy Now</span>
                  <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </main>
      </div>
    </>
  );
}

