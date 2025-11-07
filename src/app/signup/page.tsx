"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUp, signIn } from "@/lib/auth-client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Mail, Lock, User, Loader2, CheckCircle, BookOpen } from "lucide-react";

export default function SignupPage() {
	const router = useRouter();
	const [formData, setFormData] = useState({
		name: "",
		email: "",
		password: "",
		confirmPassword: ""
	});
	const [isLoading, setIsLoading] = useState(false);
	const [signupSuccess, setSignupSuccess] = useState(false);
	const [error, setError] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		// Validate passwords match
		if (formData.password !== formData.confirmPassword) {
			setError("Passwords do not match");
			return;
		}

		// Validate password length
		if (formData.password.length < 8) {
			setError("Password must be at least 8 characters");
			return;
		}

		setIsLoading(true);

		try {
			// Create the account with Better Auth
			const result = await signUp.email({
				name: formData.name,
				email: formData.email,
				password: formData.password,
			});

			console.log("Signup result:", result);

			if (result.error) {
				console.error("Signup error:", result.error);
				const errorCode = result.error.code || result.error.status;
				const errorMessage = result.error.message || "Unable to create account";
				
				if (errorCode === "USER_ALREADY_EXISTS" || errorMessage.includes("already exists")) {
					throw new Error("An account with this email already exists. Please sign in instead.");
				} else {
					throw new Error(errorMessage);
				}
			}

			// Show success message - don't try to sign in automatically since email verification is required
			setSignupSuccess(true);
			// Don't redirect - let user stay on the page to see the verification message
		} catch (error: any) {
			console.error("Signup failed:", error);
			console.error("Error details:", {
				message: error?.message,
				status: error?.status,
				code: error?.code,
				error: error?.error,
				fullError: error
			});
			
			// Extract error message from various possible formats
			let errorMessage = "Unable to create account. Please try again.";
			
			if (error?.message) {
				errorMessage = error.message;
			} else if (error?.error) {
				errorMessage = typeof error.error === "string" ? error.error : error.error.message || errorMessage;
			} else if (error?.status === 500) {
				errorMessage = "Server error occurred. Please check the server logs for details.";
			} else if (error?.toString && error.toString() !== "[object Object]") {
				errorMessage = error.toString();
			}
			
			setError(errorMessage);
		} finally {
			setIsLoading(false);
		}
	};

	const handleGoogleSignIn = async () => {
		try {
			await signIn.social({
				provider: "google",
				callbackURL: "/dashboard",
			});
		} catch (error) {
			console.error("Google signup failed:", error);
			setError("Unable to authenticate with Google");
		}
	};

	if (signupSuccess) {
		return (
			<div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ backgroundImage: 'url(/booksborder.png)', backgroundRepeat: 'repeat-x', backgroundPosition: 'top', backgroundSize: 'auto 320px' }}>
				<Card className="w-full max-w-md border-orange-200">
					<CardContent className="pt-6">
						<div className="text-center space-y-4">
							<div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
								<CheckCircle className="w-8 h-8 text-green-600" />
							</div>
							<h2 className="text-2xl font-bold text-gray-900">Check Your Email!</h2>
							<p className="text-gray-600">
								Your account has been created successfully.
							</p>
							<p className="text-sm text-gray-500">
								We've sent a verification link to your email address. Please check your inbox and click the link to verify your account.
							</p>
							<div className="pt-6">
								<Link href="/login">
									<Button className="w-full bg-orange-600 hover:bg-orange-700">
										Continue to Sign In
									</Button>
								</Link>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

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
					<h1 className="text-3xl font-bold mb-4 text-gray-900">Create Your Account</h1>
					<p className="text-gray-600">
						Join Get Lost and start analyzing your books
					</p>
				</div>

				<Card className="border-orange-200 shadow-lg">
					<CardHeader className="space-y-3">
						<CardTitle>Sign Up for Get Lost</CardTitle>
						<CardDescription>
							Create your account using email or Google
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{error && (
								<div className="bg-red-50 text-red-800 p-3 rounded-md text-sm">
									{error}
								</div>
							)}

							<form onSubmit={handleSubmit} className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="name">
										<User className="w-4 h-4 inline mr-2" />
										Full Name
									</Label>
									<Input
										id="name"
										type="text"
										placeholder="Jane Doe"
										value={formData.name}
										onChange={(e) => setFormData({ ...formData, name: e.target.value })}
										disabled={isLoading}
										required
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="email">
										<Mail className="w-4 h-4 inline mr-2" />
										Email Address
									</Label>
									<Input
										id="email"
										type="email"
										placeholder="author@example.com"
										value={formData.email}
										onChange={(e) => setFormData({ ...formData, email: e.target.value })}
										disabled={isLoading}
										required
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="password">
										<Lock className="w-4 h-4 inline mr-2" />
										Password
									</Label>
									<Input
										id="password"
										type="password"
										placeholder="Minimum 8 characters"
										value={formData.password}
										onChange={(e) => setFormData({ ...formData, password: e.target.value })}
										disabled={isLoading}
										required
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="confirmPassword">
										<Lock className="w-4 h-4 inline mr-2" />
										Confirm Password
									</Label>
									<Input
										id="confirmPassword"
										type="password"
										placeholder="Re-enter your password"
										value={formData.confirmPassword}
										onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
										disabled={isLoading}
										required
									/>
								</div>

								<Button
									type="submit"
									className="w-full bg-orange-600 hover:bg-orange-700"
									disabled={isLoading}
								>
									{isLoading ? (
										<>
											<Loader2 className="w-4 h-4 mr-2 animate-spin" />
											Creating Account...
										</>
									) : (
										"Create Account"
									)}
								</Button>
							</form>

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
								disabled={isLoading}
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
								Sign up with Google
							</Button>

							{/* Sign In Link */}
							<div className="text-center text-sm text-gray-600">
								Already have an account?{" "}
								<Link href="/login" className="text-orange-600 hover:text-orange-700 font-medium">
									Sign in
								</Link>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}