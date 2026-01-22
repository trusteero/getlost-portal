"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ImageCarousel } from "@/components/image-carousel";
import { Loader2, ArrowUpRight } from "lucide-react";
import { Red_Hat_Display, Geist, DM_Sans, Crimson_Text } from "next/font/google";

const redHatDisplay = Red_Hat_Display({
  subsets: ["latin"],
  variable: "--font-red-hat-display",
  weight: ["400", "500", "600", "700"],
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
});

const crimsonText = Crimson_Text({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-crimson-text",
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
                  width={180}
                  height={60}
                  className="h-12 w-auto"
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

      {/* Desktop Layout - Campaign Landing Page */}
      <div className={`hidden lg:block min-h-screen bg-white ${dmSans.variable} ${crimsonText.variable}`}>
        {/* Header with Logo */}
        <header className="px-8 py-6 md:px-16 lg:px-24">
          <Link href="/">
            <Image
              src="/getlost-logo-CcbncUJ4.png"
              alt="Get Lost Logo"
              width={112}
              height={112}
              className="h-20 w-20 md:h-28 md:w-28"
              priority
            />
          </Link>
        </header>

        {/* Main Content */}
        <main className="px-8 md:px-16 lg:px-24">
          {/* Hero Section */}
          <section className="text-center mb-12 md:mb-16">
            <h1
              className="mb-8 md:mb-12"
              style={{
                fontFamily: "var(--font-crimson-text)",
                fontSize: "clamp(2.5rem, 6vw, 7rem)",
                lineHeight: "0.9",
                letterSpacing: "-0.04em",
                color: "#000",
              }}
            >
              Publish with intent.
            </h1>
          </section>

          {/* CTA Section */}
          <section className="text-center max-w-5xl mx-auto mb-12 md:mb-16">
            <h2
              className="mb-8 md:mb-12"
              style={{
                fontFamily: "var(--font-crimson-text)",
                fontSize: "clamp(2rem, 5vw, 4.5rem)",
                lineHeight: "0.85",
                letterSpacing: "-0.05em",
                color: "#000",
              }}
            >
              Gain insights that convert into book sales.
            </h2>

            {/* Error Message */}
            {error && (
              <p className="text-sm text-red-600 text-center max-w-md mb-4">{error}</p>
            )}

            <button
              onClick={handlePurchase}
              disabled={loading}
              className="inline-flex items-center gap-4 bg-[#ff8d28] text-white px-10 py-6 rounded-full font-bold text-xl tracking-[-0.025em] hover:bg-[#ff9d3d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  BUY NOW
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M7 7h10v10"></path>
                    <path d="M7 17 17 7"></path>
                  </svg>
                </>
              )}
            </button>
          </section>

          {/* Dashboard Preview Section */}
          <section className="relative max-w-6xl mx-auto mb-16 md:mb-24">
            {/* Orange background block */}
            <div
              className="absolute inset-0 bg-[#f2995b] rounded-[30px] -mx-8 md:-mx-16 lg:-mx-24 h-[350px] md:h-[400px] bottom-0 top-auto z-0"
            ></div>

            {/* Dashboard frame */}
            <div className="relative z-10 bg-[#969696] rounded-t-[20px] p-1">
              <div className="bg-black rounded-t-[20px] p-1">
                <div className="bg-white rounded-t-[20px] overflow-hidden">
                  <ImageCarousel images={desktopCarouselImages} autoPlay={true} interval={2000} />
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

