"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ImageCarousel } from "@/components/image-carousel";
import { Loader2, ArrowUpRight } from "lucide-react";
import { Red_Hat_Display, Geist } from "next/font/google";

const redHatDisplay = Red_Hat_Display({
  subsets: ["latin"],
  variable: "--font-red-hat-display",
  weight: ["400", "500", "600", "700"],
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
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
      <div className={`lg:hidden min-h-screen bg-[#FCFDFD] ${redHatDisplay.variable} ${geist.variable}`}>
        {/* Banner Section */}
        <header className="bg-white">
          <div className="max-w-7xl mx-auto px-4 pt-3 pb-5">
            <div className="flex items-start justify-between max-w-md mx-auto">
              {/* Left: Logo */}
              <Link href="/" className="flex items-center gap-2 pt-3">
                <Image
                  src="/getlost-logo-CcbncUJ4.png"
                  alt="Get Lost"
                  width={120}
                  height={40}
                  className="h-8 w-auto"
                  priority
                />
              </Link>
              
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

        {/* Buy Now Button - Sticky at bottom for mobile */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg p-4">
          <div className="max-w-md mx-auto">
            {error && (
              <p className="text-sm text-red-600 text-center mb-2">{error}</p>
            )}
            <button
              onClick={handlePurchase}
              disabled={loading}
              className="buy-button w-full py-6 sm:py-8 px-6 sm:px-8 text-center cursor-pointer active:scale-[0.98] transition-transform"
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
          </div>
        </div>
        {/* Spacer to prevent content from being hidden behind sticky button */}
        <div className="h-32"></div>
      </div>

      {/* Desktop Layout - New Design */}
      <div className={`hidden lg:block min-h-screen bg-white relative overflow-hidden ${geist.variable}`}>
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
              <Link href="/" className="flex items-center">
                <Image
                  src="/getlost-logo-CcbncUJ4.png"
                  alt="Get Lost"
                  width={150}
                  height={50}
                  className="h-10 w-auto"
                  priority
                />
              </Link>
              
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
            <h1 className="text-5xl lg:text-7xl font-bold text-black text-center max-w-4xl" style={{ fontFamily: "var(--font-geist-sans)" }}>
              Publish with intent.
            </h1>

            {/* Carousel Section */}
            <div className="w-full max-w-5xl lg:max-w-6xl">
              <div className="relative">
                <ImageCarousel images={desktopCarouselImages} autoPlay={true} interval={3000} />
              </div>
            </div>

            {/* Tagline */}
            <p className="text-3xl lg:text-4xl font-bold text-black text-center max-w-3xl" style={{ fontFamily: "var(--font-geist-sans)" }}>
              Gain insights that convert into book sales.
            </p>

            {/* Error Message */}
            {error && (
              <p className="text-sm text-red-600 text-center max-w-md">{error}</p>
            )}

            {/* Buy Now Button - Sticky at bottom */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg p-4">
              <div className="max-w-7xl mx-auto flex justify-center">
                <button
                  onClick={handlePurchase}
                  disabled={loading}
                  className="group relative bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-4 rounded-lg transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ fontFamily: "var(--font-geist-sans)" }}
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
            </div>
          </div>
        </main>
        {/* Spacer to prevent content from being hidden behind sticky button */}
        <div className="h-24"></div>
      </div>
    </>
  );
}

