import Link from "next/link";
import { ArrowRight, BookOpen, FileText, Sparkles, Zap, Shield, BarChart3 } from "lucide-react";

import { auth } from "@/server/auth";
import { HydrateClient, api } from "@/trpc/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function Home() {
	const session = await auth();

	return (
		<HydrateClient>
			<div className="min-h-screen bg-black text-white">
				{/* Gradient background */}
				<div className="absolute inset-0 bg-gradient-to-tr from-purple-900/20 via-transparent to-blue-900/20" />
				<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-900/10 via-transparent to-transparent" />

				{/* Navigation */}
				<nav className="relative z-10 border-b border-white/10 backdrop-blur-sm">
					<div className="container mx-auto px-4">
						<div className="flex items-center justify-between h-16">
							<div className="flex items-center space-x-8">
								<Link href="/" className="flex items-center space-x-2">
									<BookOpen className="h-6 w-6 text-purple-400" />
									<span className="text-xl font-semibold">Get Lost</span>
								</Link>
								<div className="hidden md:flex space-x-6">
									<Link href="#features" className="text-gray-400 hover:text-white transition">Features</Link>
									<Link href="#how-it-works" className="text-gray-400 hover:text-white transition">How it works</Link>
									<Link href="#pricing" className="text-gray-400 hover:text-white transition">Pricing</Link>
								</div>
							</div>
							<div className="flex items-center space-x-4">
								{session ? (
									<>
										<Link href="/dashboard">
											<Button variant="ghost" className="text-gray-400 hover:text-white">
												Dashboard
											</Button>
										</Link>
										<Link href="/api/auth/signout">
											<Button variant="outline" className="border-white/20 hover:bg-white/10">
												Sign out
											</Button>
										</Link>
									</>
								) : (
									<>
										<Link href="/api/auth/signin">
											<Button variant="ghost" className="text-gray-400 hover:text-white">
												Sign in
											</Button>
										</Link>
										<Link href="/api/auth/signin">
											<Button className="bg-purple-600 hover:bg-purple-700 text-white">
												Get Started
											</Button>
										</Link>
									</>
								)}
							</div>
						</div>
					</div>
				</nav>

				<div className="relative z-10">
					{/* Hero Section */}
					<section className="container mx-auto px-4 py-24 md:py-32">
						<div className="max-w-4xl mx-auto text-center">
							<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-400 text-sm mb-8">
								<Sparkles className="h-4 w-4" />
								AI-Powered Book Analysis
							</div>
							<h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
								Transform Your Manuscript Into Success
							</h1>
							<p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
								Get comprehensive, AI-powered feedback on your book in minutes.
								Understand your audience, improve your narrative, and maximize your book's potential.
							</p>
							<div className="flex flex-col sm:flex-row gap-4 justify-center">
								<Link href="/api/auth/signin">
									<Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white px-8">
										Start Your Analysis
										<ArrowRight className="ml-2 h-4 w-4" />
									</Button>
								</Link>
								<Button size="lg" variant="outline" className="border-white/20 hover:bg-white/10">
									View Sample Report
								</Button>
							</div>
						</div>
					</section>

					{/* Features Grid */}
					<section id="features" className="container mx-auto px-4 py-24">
						<div className="text-center mb-16">
							<h2 className="text-3xl md:text-4xl font-bold mb-4">
								Everything Authors Need to Succeed
							</h2>
							<p className="text-gray-400 max-w-2xl mx-auto">
								Our AI analyzes every aspect of your manuscript to provide actionable insights
							</p>
						</div>

						<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
							<Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
								<CardContent className="p-6">
									<div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
										<FileText className="h-6 w-6 text-purple-400" />
									</div>
									<h3 className="text-lg font-semibold mb-2">Detailed Structure Analysis</h3>
									<p className="text-gray-400 text-sm">
										Get insights on pacing, plot development, and narrative structure
									</p>
								</CardContent>
							</Card>

							<Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
								<CardContent className="p-6">
									<div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
										<BarChart3 className="h-6 w-6 text-blue-400" />
									</div>
									<h3 className="text-lg font-semibold mb-2">Market Positioning</h3>
									<p className="text-gray-400 text-sm">
										Understand your book's market fit and competitive landscape
									</p>
								</CardContent>
							</Card>

							<Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
								<CardContent className="p-6">
									<div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-4">
										<Zap className="h-6 w-6 text-green-400" />
									</div>
									<h3 className="text-lg font-semibold mb-2">Instant Results</h3>
									<p className="text-gray-400 text-sm">
										Receive your comprehensive report in under 5 minutes
									</p>
								</CardContent>
							</Card>

							<Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
								<CardContent className="p-6">
									<div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center mb-4">
										<Sparkles className="h-6 w-6 text-orange-400" />
									</div>
									<h3 className="text-lg font-semibold mb-2">Character Development</h3>
									<p className="text-gray-400 text-sm">
										Deep analysis of character arcs, dialogue, and relationships
									</p>
								</CardContent>
							</Card>

							<Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
								<CardContent className="p-6">
									<div className="h-12 w-12 rounded-lg bg-pink-500/10 flex items-center justify-center mb-4">
										<BookOpen className="h-6 w-6 text-pink-400" />
									</div>
									<h3 className="text-lg font-semibold mb-2">Genre Optimization</h3>
									<p className="text-gray-400 text-sm">
										Ensure your book meets and exceeds genre expectations
									</p>
								</CardContent>
							</Card>

							<Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
								<CardContent className="p-6">
									<div className="h-12 w-12 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-4">
										<Shield className="h-6 w-6 text-indigo-400" />
									</div>
									<h3 className="text-lg font-semibold mb-2">Confidential & Secure</h3>
									<p className="text-gray-400 text-sm">
										Your manuscript is encrypted and never shared or stored
									</p>
								</CardContent>
							</Card>
						</div>
					</section>

					{/* How it works */}
					<section id="how-it-works" className="container mx-auto px-4 py-24">
						<div className="max-w-4xl mx-auto">
							<div className="text-center mb-16">
								<h2 className="text-3xl md:text-4xl font-bold mb-4">
									Three Simple Steps to Better Writing
								</h2>
								<p className="text-gray-400">
									From submission to insights in minutes
								</p>
							</div>

							<div className="space-y-8">
								<div className="flex gap-4 items-start">
									<div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
										<span className="text-purple-400 font-semibold">1</span>
									</div>
									<div>
										<h3 className="text-lg font-semibold mb-2">Upload Your Manuscript</h3>
										<p className="text-gray-400">
											Simply upload your book in any format - DOCX, PDF, or plain text. Our system handles the rest.
										</p>
									</div>
								</div>

								<div className="flex gap-4 items-start">
									<div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
										<span className="text-purple-400 font-semibold">2</span>
									</div>
									<div>
										<h3 className="text-lg font-semibold mb-2">AI Analysis</h3>
										<p className="text-gray-400">
											Our advanced AI reads and analyzes your entire manuscript, examining structure, style, and market potential.
										</p>
									</div>
								</div>

								<div className="flex gap-4 items-start">
									<div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
										<span className="text-purple-400 font-semibold">3</span>
									</div>
									<div>
										<h3 className="text-lg font-semibold mb-2">Get Your Report</h3>
										<p className="text-gray-400">
											Receive a comprehensive report with actionable feedback, market insights, and specific recommendations for improvement.
										</p>
									</div>
								</div>
							</div>
						</div>
					</section>

					{/* CTA Section */}
					<section className="container mx-auto px-4 py-24">
						<div className="max-w-4xl mx-auto">
							<Card className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 border-white/10">
								<CardContent className="p-12 text-center">
									<h2 className="text-3xl md:text-4xl font-bold mb-4">
										Ready to Transform Your Manuscript?
									</h2>
									<p className="text-gray-300 mb-8 max-w-2xl mx-auto">
										Join thousands of authors who've improved their books with Get Lost.
										Start your journey to publication success today.
									</p>
									<Link href="/api/auth/signin">
										<Button size="lg" className="bg-white text-black hover:bg-gray-200 px-8">
											Get Your Report Now
											<ArrowRight className="ml-2 h-4 w-4" />
										</Button>
									</Link>
									<p className="text-sm text-gray-400 mt-4">
										No credit card required • 5 minute analysis • Instant results
									</p>
								</CardContent>
							</Card>
						</div>
					</section>

					{/* Footer */}
					<footer className="border-t border-white/10 mt-24">
						<div className="container mx-auto px-4 py-8">
							<div className="flex flex-col md:flex-row items-center justify-between">
								<div className="flex items-center space-x-2 mb-4 md:mb-0">
									<BookOpen className="h-5 w-5 text-purple-400" />
									<span className="text-gray-400">© 2024 Get Lost. All rights reserved.</span>
								</div>
								<div className="flex space-x-6">
									<Link href="#" className="text-gray-400 hover:text-white transition">Privacy</Link>
									<Link href="#" className="text-gray-400 hover:text-white transition">Terms</Link>
									<Link href="#" className="text-gray-400 hover:text-white transition">Contact</Link>
								</div>
							</div>
						</div>
					</footer>
				</div>
			</div>
		</HydrateClient>
	);
}