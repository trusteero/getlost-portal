"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
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
			// For now, we'll use NextAuth's signIn with credentials
			// You'll need to implement the actual signup logic in your auth configuration
			const result = await signIn("credentials", {
				redirect: false,
				email: formData.email,
				password: formData.password,
				name: formData.name,
			});

			if (result?.error) {
				throw new Error(result.error);
			}

			// Show success message
			setSignupSuccess(true);

			// Redirect after a short delay
			setTimeout(() => {
				router.push("/dashboard");
			}, 2000);
		} catch (error: any) {
			console.error("Signup failed:", error);
			setError(error.message || "Unable to create account");
		} finally {
			setIsLoading(false);
		}
	};

	const handleGoogleSignIn = async () => {
		try {
			await signIn("google", { callbackUrl: "/dashboard" });
		} catch (error) {
			console.error("Google signup failed:", error);
			setError("Unable to authenticate with Google");
		}
	};

	if (signupSuccess) {
		return (
			<div className="min-h-screen bg-gradient-to-b from-sky-100 via-orange-50/30 to-white flex items-center justify-center px-4 py-12">
				<Card className="w-full max-w-md border-orange-200">
					<CardContent className="pt-6">
						<div className="text-center space-y-4">
							<div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
								<CheckCircle className="w-8 h-8 text-green-600" />
							</div>
							<h2 className="text-2xl font-bold text-gray-900">Welcome to Get Lost!</h2>
							<p className="text-gray-600">
								Your account has been created successfully.
							</p>
							<p className="text-sm text-gray-500">
								Get ready to transform your manuscript into your best work.
							</p>
							<div className="pt-4">
								<Loader2 className="w-4 h-4 animate-spin mx-auto text-orange-600" />
								<p className="text-sm text-gray-500 mt-2">Redirecting to dashboard...</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-b from-sky-100 via-orange-50/30 to-white flex items-center justify-center px-4 py-12">
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

					<h1 className="text-3xl font-bold mb-4 text-gray-900">Join Get Lost</h1>
					<p className="text-gray-600">
						Start your journey to better writing today
					</p>
				</div>

				<Card className="border-orange-200 shadow-lg">
					<CardHeader className="space-y-3">
						<CardTitle>Create Your Author Account</CardTitle>
						<CardDescription>
							Join thousands of authors improving their craft
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<Button
								onClick={handleGoogleSignIn}
								variant="outline"
								className="w-full border-gray-300 hover:bg-gray-50"
								disabled={isLoading}
							>
								<svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
									<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
									<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
									<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
									<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
								</svg>
								Sign up with Google
							</Button>

							<div className="relative">
								<div className="absolute inset-0 flex items-center">
									<span className="w-full border-t border-gray-200" />
								</div>
								<div className="relative flex justify-center text-xs uppercase">
									<span className="bg-white px-2 text-gray-500">
										Or continue with email
									</span>
								</div>
							</div>

							{error && (
								<div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-md text-sm">
									{error}
								</div>
							)}

							<form onSubmit={handleSubmit} className="space-y-4">
								<div>
									<Label htmlFor="name" className="mb-2">Full Name</Label>
									<div className="relative mt-1">
										<User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
										<Input
											id="name"
											type="text"
											placeholder="Jane Doe"
											value={formData.name}
											onChange={(e) => setFormData({ ...formData, name: e.target.value })}
											className="pl-10 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
											required
											disabled={isLoading}
										/>
									</div>
								</div>

								<div>
									<Label htmlFor="email" className="mb-2">Email</Label>
									<div className="relative mt-1">
										<Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
										<Input
											id="email"
											type="email"
											placeholder="author@example.com"
											value={formData.email}
											onChange={(e) => setFormData({ ...formData, email: e.target.value })}
											className="pl-10 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
											required
											disabled={isLoading}
										/>
									</div>
								</div>

								<div>
									<Label htmlFor="password" className="mb-2">Password</Label>
									<div className="relative mt-1">
										<Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
										<Input
											id="password"
											type="password"
											placeholder="••••••••"
											value={formData.password}
											onChange={(e) => setFormData({ ...formData, password: e.target.value })}
											className="pl-10 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
											required
											minLength={8}
											disabled={isLoading}
										/>
									</div>
									<p className="text-xs text-gray-500 mt-1">
										Must be at least 8 characters
									</p>
								</div>

								<div>
									<Label htmlFor="confirmPassword" className="mb-2">Confirm Password</Label>
									<div className="relative mt-1">
										<Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
										<Input
											id="confirmPassword"
											type="password"
											placeholder="••••••••"
											value={formData.confirmPassword}
											onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
											className="pl-10 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
											required
											minLength={8}
											disabled={isLoading}
										/>
									</div>
								</div>

								<Button
									type="submit"
									className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
									disabled={isLoading}
								>
									{isLoading ? (
										<>
											<Loader2 className="w-4 h-4 mr-2 animate-spin" />
											Creating Account...
										</>
									) : (
										"Create Author Account"
									)}
								</Button>
							</form>

							<p className="text-center text-sm text-gray-600">
								Already have an account?{" "}
								<Link
									href="/api/auth/signin"
									className="text-orange-600 hover:text-orange-700 font-medium"
								>
									Sign in
								</Link>
							</p>

							<p className="text-xs text-center text-gray-500">
								By signing up, you agree to our{" "}
								<Link href="/terms" className="text-orange-600 hover:text-orange-700 underline">
									Terms of Service
								</Link>
								{" "}and{" "}
								<Link href="/privacy" className="text-orange-600 hover:text-orange-700 underline">
									Privacy Policy
								</Link>
							</p>
						</div>
					</CardContent>
				</Card>

				<div className="mt-8 text-center">
					<p className="text-sm text-gray-600">
						✨ Join hundreds of authors improving their craft
					</p>
				</div>
			</div>
		</div>
	);
}