import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { LatestPost } from "@/app/_components/post";
import { auth } from "@/server/auth";
import { HydrateClient, api } from "@/trpc/server";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default async function Home() {
	const hello = await api.post.hello({ text: "from tRPC" });
	const session = await auth();

	if (session?.user) {
		void api.post.getLatest.prefetch();
	}

	return (
		<HydrateClient>
			<div className="min-h-screen bg-gradient-to-b from-zinc-900 via-purple-900/20 to-zinc-900">
				<div className="container mx-auto px-4 py-16">
					{/* Hero Section */}
					<div className="flex flex-col items-center text-center mb-16">
						<h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6">
							Create <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">T3</span> App
						</h1>
						<p className="text-xl text-zinc-300 max-w-2xl mb-8">
							The best way to start a full-stack, typesafe Next.js app
						</p>

						{/* Auth Section */}
						<div className="flex flex-col items-center gap-4 mb-8">
							{session && (
								<p className="text-lg text-zinc-300">
									Welcome back, <span className="font-semibold text-white">{session.user?.name}</span>
								</p>
							)}
							<Button
								variant={session ? "outline" : "default"}
								size="lg"
								className="min-w-[150px]"
								asChild
							>
								<Link href={session ? "/api/auth/signout" : "/api/auth/signin"}>
									{session ? "Sign out" : "Get Started"}
								</Link>
							</Button>
						</div>
					</div>

					{/* Cards Section */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-12">
						<Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-sm hover:bg-zinc-900/70 transition-all">
							<Link href="https://create.t3.gg/en/usage/first-steps" target="_blank" className="block h-full">
								<CardHeader>
									<CardTitle className="flex items-center justify-between text-white">
										First Steps
										<ArrowRight className="h-5 w-5" />
									</CardTitle>
								</CardHeader>
								<CardContent>
									<CardDescription className="text-zinc-400">
										Just the basics - Everything you need to know to set up your
										database and authentication.
									</CardDescription>
								</CardContent>
							</Link>
						</Card>

						<Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-sm hover:bg-zinc-900/70 transition-all">
							<Link href="https://create.t3.gg/en/introduction" target="_blank" className="block h-full">
								<CardHeader>
									<CardTitle className="flex items-center justify-between text-white">
										Documentation
										<ArrowRight className="h-5 w-5" />
									</CardTitle>
								</CardHeader>
								<CardContent>
									<CardDescription className="text-zinc-400">
										Learn more about Create T3 App, the libraries it uses, and how
										to deploy it.
									</CardDescription>
								</CardContent>
							</Link>
						</Card>
					</div>

					{/* tRPC Status */}
					<div className="text-center mb-12">
						<div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900/50 backdrop-blur-sm rounded-full border border-zinc-800">
							<div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
							<p className="text-sm text-zinc-300">
								{hello ? hello.greeting : "Connecting to tRPC..."}
							</p>
						</div>
					</div>

					{/* Latest Post Section */}
					{session?.user && (
						<div className="max-w-4xl mx-auto">
							<LatestPost />
						</div>
					)}
				</div>
			</div>
		</HydrateClient>
	);
}