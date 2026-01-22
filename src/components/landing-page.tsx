"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { DM_Sans, Crimson_Text } from "next/font/google";

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

const carouselImages = [
  "/Carousel1.png",
  "/Carousel2.png",
  "/Carousel3.png",
  "/Carousel4.png",
  "/Carousel5.png",
];

export default function LandingPage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselImages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
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

          <Link
            href="/purchase-upload"
            className="inline-flex items-center gap-4 bg-[#ff8d28] text-white px-10 py-6 rounded-full font-bold text-xl tracking-[-0.025em] hover:bg-[#ff9d3d] transition-colors"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
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
          </Link>
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
                <Image
                  src={carouselImages[currentSlide]}
                  alt="Dashboard Preview"
                  width={1200}
                  height={500}
                  className="w-full h-auto object-cover object-top max-h-[500px]"
                  priority={currentSlide === 0}
                />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
