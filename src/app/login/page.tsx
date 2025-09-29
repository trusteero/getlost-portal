"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Mail, Lock, Send, Loader2, BookOpen } from "lucide-react";

function LoginContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [activeTab, setActiveTab] = useState<"email">("email");
	const [emailLogin, setEmailLogin] = useState({ email: "", password: "" });
	const [magicEmail, setMagicEmail] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [magicLinkSent, setMagicLinkSent] = useState(false);
	const [error, setError] = useState("");
	const [successMessage, setSuccessMessage] = useState("");
	const [emailNotVerified, setEmailNotVerified] = useState(false);

	useEffect(() => {
		if (searchParams.get("verified") === "true") {
			setSuccessMessage("Email verified successfully! You can now sign in.");
		}
		if (searchParams.get("reset") === "true") {
			setSuccessMessage("Password reset successfully! You can now sign in with your new password.");
		}
	}, [searchParams]);

	const handleEmailLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setEmailNotVerified(false);
		setIsSubmitting(true);

		try {
			const result = await signIn.email({
				email: emailLogin.email,
				password: emailLogin.password,
				callbackURL: "/dashboard",
			});

			if (result.error) {
				// Check various error types
				if (result.error.code === "EMAIL_NOT_VERIFIED") {
					setEmailNotVerified(true);
					throw new Error("Please verify your email before signing in. Check your inbox (and spam folder) for the verification link.");
				} else if (result.error.code === "INVALID_CREDENTIALS") {
					throw new Error("Invalid email or password. Please try again.");
				} else if (result.error.code === "USER_NOT_FOUND") {
					throw new Error("No account found with this email. Please sign up first.");
				} else {
					throw new Error(result.error.message || "Sign in failed. Please try again.");
				}
			}

			// Success - Better Auth handles the redirect
			router.push("/dashboard");
		} catch (error: any) {
			console.error("Login failed:", error);
			setError(error.message || "Invalid email or password");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleMagicLink = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		setError("");

		try {
			const response = await fetch("/api/auth/magic-link", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ email: magicEmail }),
			});

			if (!response.ok) {
				throw new Error("Failed to send magic link");
			}

			setMagicLinkSent(true);
		} catch (error: any) {
			console.error("Magic link failed:", error);
			setError("Unable to send magic link. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleGoogleSignIn = async () => {
		try {
			await signIn.social({
				provider: "google",
				callbackURL: "/dashboard",
			});
		} catch (error) {
			console.error("Google signin failed:", error);
			setError("Unable to authenticate with Google");
		}
	};

	const handleResendVerification = async () => {
		if (!emailLogin.email) {
			setError("Please enter your email address first");
			return;
		}

		setIsSubmitting(true);
		setError("");
		setSuccessMessage("");

		try {
			const response = await fetch("/api/auth/resend-verification", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: emailLogin.email }),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to resend verification email");
			}

			setSuccessMessage("Verification email sent! Please check your inbox and spam folder.");
			setEmailNotVerified(false);
		} catch (error: any) {
			setError(error.message || "Failed to resend verification email");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ backgroundImage: 'url(/booksborder.png)', backgroundRepeat: 'repeat-x', backgroundPosition: 'top', backgroundSize: 'auto 320px' }}>
			<div className="w-full max-w-md">
				<div className="mb-8 text-center">
					<Link href="/">
						<Button
							variant="ghost"
							size="sm"
							className="mb-6 text-gray-600 hover:text-gray-900"
						>
							<ArrowLeft className="w-4 h-4 mr-2" />
							Back to Home
						</Button>
					</Link>

					<div className="flex justify-center mb-4">
						<img src="/logo256.png" alt="Get Lost" className="h-16 w-16" />
					</div>
					<h1 className="text-3xl font-bold mb-4 text-gray-900">Welcome Back</h1>
					<p className="text-gray-600">
						Sign in to access your author dashboard
					</p>
				</div>

				<Card className="border-orange-200 shadow-lg">
					<CardHeader className="space-y-3">
						<CardTitle>Sign In to Get Lost</CardTitle>
						<CardDescription>
							Choose your preferred sign in method
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{/* Success/Error Messages */}
							{successMessage && (
								<div className="bg-green-50 text-green-800 p-3 rounded-md text-sm">
									{successMessage}
								</div>
							)}

							{error && (
								<div className="bg-red-50 text-red-800 p-3 rounded-md text-sm">
									{error}
								</div>
							)}

							{/* Email Not Verified Warning */}
							{emailNotVerified && (
								<div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md">
									<p className="text-sm text-yellow-800 mb-3">
										Please verify your email before signing in.
									</p>
									<Button
										onClick={handleResendVerification}
										variant="outline"
										size="sm"
										disabled={isSubmitting}
										className="w-full"
									>
										{isSubmitting ? (
											<>
												<Loader2 className="w-4 h-4 mr-2 animate-spin" />
												Sending...
											</>
										) : (
											<>
												<Mail className="w-4 h-4 mr-2" />
												Resend Verification Email
											</>
										)}
									</Button>
								</div>
							)}

							{/* Email & Password Form */}
							{activeTab === "email" && !magicLinkSent && (
								<form onSubmit={handleEmailLogin} className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="email">
											<Mail className="w-4 h-4 inline mr-2" />
											Email Address
										</Label>
										<Input
											id="email"
											type="email"
											placeholder="author@example.com"
											value={emailLogin.email}
											onChange={(e) => setEmailLogin({ ...emailLogin, email: e.target.value })}
											disabled={isSubmitting}
											required
										/>
									</div>

									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<Label htmlFor="password">
												<Lock className="w-4 h-4 inline mr-2" />
												Password
											</Label>
											<Link
												href="/auth/forgot-password"
												className="text-sm text-orange-600 hover:text-orange-700"
											>
												Forgot password?
											</Link>
										</div>
										<Input
											id="password"
											type="password"
											placeholder="Enter your password"
											value={emailLogin.password}
											onChange={(e) => setEmailLogin({ ...emailLogin, password: e.target.value })}
											disabled={isSubmitting}
											required
										/>
									</div>

									<Button
										type="submit"
										className="w-full bg-orange-600 hover:bg-orange-700"
										disabled={isSubmitting}
									>
										{isSubmitting ? (
											<>
												<Loader2 className="w-4 h-4 mr-2 animate-spin" />
												Signing In...
											</>
										) : (
											"Sign In with Email"
										)}
									</Button>
								</form>
							)}

							{/* Divider */}
							<div className="relative">
								<div className="absolute inset-0 flex items-center">
									<div className="w-full border-t border-gray-200" />
								</div>
								<div className="relative flex justify-center text-xs">
									<span className="bg-white px-2 text-gray-500">Or continue with</span>
								</div>
							</div>

							{/* Google Sign In */}
							<Button
								type="button"
								variant="outline"
								className="w-full"
								onClick={handleGoogleSignIn}
								disabled={isSubmitting}
							>
								<svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
									<path
										fill="#4285F4"
										d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
									/>
									<path
										fill="#34A853"
										d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
									/>
									<path
										fill="#FBBC05"
										d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
									/>
									<path
										fill="#EA4335"
										d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
									/>
								</svg>
								Sign in with Google
							</Button>

							{/* Sign Up Link */}
							<div className="text-center text-sm text-gray-600">
								Don't have an account?{" "}
								<Link href="/signup" className="text-orange-600 hover:text-orange-700 font-medium">
									Sign up
								</Link>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

export default function LoginPage() {
	return (
		<Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
			<LoginContent />
		</Suspense>
	);
}