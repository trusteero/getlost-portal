"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function SignInForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const callbackUrl = searchParams.get("callbackUrl") ?? "/";
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setIsLoading(true);

		try {
			const result = await signIn("credentials", {
				username,
				password,
				redirect: false,
			});

			if (result?.error) {
				setError("Invalid username or password");
				setIsLoading(false);
			} else {
				router.push(callbackUrl);
				router.refresh();
			}
		} catch (err) {
			setError("An error occurred. Please try again.");
			setIsLoading(false);
		}
	};

	return (
		<main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
			<div className="container flex flex-col items-center justify-center gap-8 px-4 py-16">
				<h1 className="font-extrabold text-5xl tracking-tight sm:text-[5rem]">
					Get<span className="text-[hsl(280,100%,70%)]">Lost</span> Portal
				</h1>

				<div className="w-full max-w-md rounded-xl bg-white/10 p-8 backdrop-blur-sm">
					<h2 className="mb-6 text-center text-3xl font-bold">Sign In</h2>

					<form onSubmit={handleSubmit} className="flex flex-col gap-4">
						<div className="flex flex-col gap-2">
							<label htmlFor="username" className="text-sm font-medium">
								Username
							</label>
							<input
								id="username"
								type="text"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								required
								className="w-full rounded-lg bg-white/10 px-4 py-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-[hsl(280,100%,70%)]"
								placeholder="Enter your username"
								disabled={isLoading}
							/>
						</div>

						<div className="flex flex-col gap-2">
							<label htmlFor="password" className="text-sm font-medium">
								Password
							</label>
							<input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								className="w-full rounded-lg bg-white/10 px-4 py-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-[hsl(280,100%,70%)]"
								placeholder="Enter your password"
								disabled={isLoading}
							/>
						</div>

						{error && (
							<div className="rounded-lg bg-red-500/20 p-3 text-sm text-red-200">
								{error}
							</div>
						)}

						<button
							type="submit"
							disabled={isLoading}
							className="mt-4 w-full rounded-full bg-white/10 px-6 py-3 font-semibold transition hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isLoading ? "Signing in..." : "Sign In"}
						</button>
					</form>

					<div className="mt-6 border-t border-white/20 pt-6">
						<p className="text-center text-sm text-white/70">
							Test credentials:
						</p>
						<div className="mt-2 flex flex-col gap-1 text-center text-xs text-white/50">
							<p>Username: <span className="font-mono">admin</span> / Password: <span className="font-mono">admin</span></p>
							<p>Username: <span className="font-mono">test</span> / Password: <span className="font-mono">test</span></p>
						</div>
					</div>
				</div>
			</div>
		</main>
	);
}

