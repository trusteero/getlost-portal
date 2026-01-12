"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Upload, CheckCircle, ArrowRight } from "lucide-react";

export default function PurchaseUploadPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

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
          // Redirect to Stripe checkout
          window.location.href = data.url;
        } else if (data.status === "completed" && data.redirectUrl) {
          // Simulated purchase - redirect to signup
          window.location.href = data.redirectUrl;
        } else {
          setError("Failed to create checkout session. Please try again.");
          setLoading(false);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Upload Your Manuscript
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Get comprehensive analysis and insights for your book. Purchase now and create your account after checkout.
          </p>
        </div>

        {/* Main Card */}
        <Card className="shadow-xl">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Book Upload Permission</CardTitle>
            <CardDescription className="text-lg mt-2">
              One-time purchase • $99.99
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePurchase} className="space-y-6">
              <div>
                <Label htmlFor="email" className="text-base font-medium">
                  Email Address
                </Label>
                <p className="text-sm text-gray-500 mb-2">
                  We'll use this to create your account after purchase
                </p>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="your@email.com"
                  className="h-12 text-base"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full h-12 text-base font-semibold"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Purchase Upload Permission
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">What's included:</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Upload and analyze one manuscript</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Comprehensive book analysis and insights</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Access to all analysis features</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Account created automatically after purchase</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                Already have an account?{" "}
                <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Trust Indicators */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Secure payment powered by Stripe</p>
        </div>
      </div>
    </div>
  );
}

