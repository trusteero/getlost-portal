import Link from "next/link";
import { ArrowRight, BookOpen, FileText, Sparkles, Zap, Shield, BarChart3, CheckCircle } from "lucide-react";

import { auth } from "@/server/auth";
import { HydrateClient, api } from "@/trpc/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function Home() {
	const session = await auth();

	return (
		<HydrateClient>
			<div className="min-h-screen bg-white">
				{/* Navigation */}
				<nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
					<div className="container mx-auto px-4">
						<div className="flex items-center justify-between h-16">
							<div className="flex items-center space-x-8">
								<Link href="/" className="flex items-center space-x-2">
									<BookOpen className="h-6 w-6 text-purple-600" />
									<span className="text-xl font-semibold text-gray-900">Get Lost</span>
								</Link>
								<div className="hidden md:flex space-x-6">
									<Link href="#features" className="text-gray-600 hover:text-gray-900 transition">Features</Link>
									<Link href="#how-it-works" className="text-gray-600 hover:text-gray-900 transition">How it works</Link>
									<Link href="#pricing" className="text-gray-600 hover:text-gray-900 transition">Pricing</Link>
								</div>
							</div>
							<div className="flex items-center space-x-4">
								{session ? (
									<>
										<Link href="/dashboard">
											<Button variant="ghost" className="text-gray-600 hover:text-gray-900">
												Dashboard
											</Button>
										</Link>
										<Link href="/api/auth/signout">
											<Button variant="outline" className="border-gray-300">
												Sign out
											</Button>
										</Link>
									</>
								) : (
									<>
										<Link href="/api/auth/signin">
											<Button variant="ghost" className="text-gray-600 hover:text-gray-900">
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

				{/* Hero Section */}
				<section className="container mx-auto px-4 py-20 md:py-28">
					<div className="max-w-4xl mx-auto text-center">
						<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-50 text-purple-700 text-sm font-medium mb-8">
							<Sparkles className="h-4 w-4" />
							AI-Powered Manuscript Analysis
						</div>
						<h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
							Transform Your Manuscript
							<span className="block text-purple-600">Into Your Best Work</span>
						</h1>
						<p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
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
							<Button size="lg" variant="outline" className="border-gray-300">
								View Sample Report
							</Button>
						</div>
						<p className="text-sm text-gray-500 mt-8">
							Trusted by over 10,000 authors • No credit card required
						</p>
					</div>
				</section>

				{/* Features Grid */}
				<section id="features" className="bg-gray-50 py-20">
					<div className="container mx-auto px-4">
						<div className="text-center mb-16">
							<h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
								Everything Authors Need to Succeed
							</h2>
							<p className="text-gray-600 max-w-2xl mx-auto">
								Our AI analyzes every aspect of your manuscript to provide actionable insights
							</p>
						</div>

						<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
							<Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
								<CardContent className="p-6">
									<div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
										<FileText className="h-6 w-6 text-purple-600" />
									</div>
									<h3 className="text-lg font-semibold text-gray-900 mb-2">Detailed Structure Analysis</h3>
									<p className="text-gray-600">
										Get insights on pacing, plot development, and narrative structure to keep readers engaged.
									</p>
								</CardContent>
							</Card>

							<Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
								<CardContent className="p-6">
									<div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
										<BarChart3 className="h-6 w-6 text-blue-600" />
									</div>
									<h3 className="text-lg font-semibold text-gray-900 mb-2">Market Positioning</h3>
									<p className="text-gray-600">
										Understand your book's market fit and competitive landscape to maximize success.
									</p>
								</CardContent>
							</Card>

							<Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
								<CardContent className="p-6">
									<div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
										<Zap className="h-6 w-6 text-green-600" />
									</div>
									<h3 className="text-lg font-semibold text-gray-900 mb-2">Instant Results</h3>
									<p className="text-gray-600">
										Receive your comprehensive report in under 5 minutes, not weeks.
									</p>
								</CardContent>
							</Card>

							<Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
								<CardContent className="p-6">
									<div className="h-12 w-12 rounded-lg bg-orange-100 flex items-center justify-center mb-4">
										<Sparkles className="h-6 w-6 text-orange-600" />
									</div>
									<h3 className="text-lg font-semibold text-gray-900 mb-2">Character Development</h3>
									<p className="text-gray-600">
										Deep analysis of character arcs, dialogue, and relationships for compelling storytelling.
									</p>
								</CardContent>
							</Card>

							<Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
								<CardContent className="p-6">
									<div className="h-12 w-12 rounded-lg bg-pink-100 flex items-center justify-center mb-4">
										<BookOpen className="h-6 w-6 text-pink-600" />
									</div>
									<h3 className="text-lg font-semibold text-gray-900 mb-2">Genre Optimization</h3>
									<p className="text-gray-600">
										Ensure your book meets and exceeds genre expectations for your target readers.
									</p>
								</CardContent>
							</Card>

							<Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
								<CardContent className="p-6">
									<div className="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center mb-4">
										<Shield className="h-6 w-6 text-indigo-600" />
									</div>
									<h3 className="text-lg font-semibold text-gray-900 mb-2">Confidential & Secure</h3>
									<p className="text-gray-600">
										Your manuscript is encrypted and never shared or stored permanently.
									</p>
								</CardContent>
							</Card>
						</div>
					</div>
				</section>

				{/* How it works */}
				<section id="how-it-works" className="py-20">
					<div className="container mx-auto px-4">
						<div className="max-w-4xl mx-auto">
							<div className="text-center mb-16">
								<h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
									Three Simple Steps to Better Writing
								</h2>
								<p className="text-gray-600">
									From submission to insights in minutes
								</p>
							</div>

							<div className="space-y-12">
								<div className="flex gap-6 items-start">
									<div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
										<span className="text-purple-600 font-bold">1</span>
									</div>
									<div>
										<h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Your Manuscript</h3>
										<p className="text-gray-600">
											Simply upload your book in any format - DOCX, PDF, or plain text. Our system handles the rest with complete confidentiality.
										</p>
									</div>
								</div>

								<div className="flex gap-6 items-start">
									<div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
										<span className="text-purple-600 font-bold">2</span>
									</div>
									<div>
										<h3 className="text-lg font-semibold text-gray-900 mb-2">AI Analysis</h3>
										<p className="text-gray-600">
											Our advanced AI reads and analyzes your entire manuscript, examining structure, style, character development, and market potential.
										</p>
									</div>
								</div>

								<div className="flex gap-6 items-start">
									<div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
										<span className="text-purple-600 font-bold">3</span>
									</div>
									<div>
										<h3 className="text-lg font-semibold text-gray-900 mb-2">Get Your Report</h3>
										<p className="text-gray-600">
											Receive a comprehensive 20+ page report with actionable feedback, market insights, and specific recommendations for improvement.
										</p>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Testimonial Section */}
				<section className="bg-purple-50 py-20">
					<div className="container mx-auto px-4">
						<div className="max-w-3xl mx-auto text-center">
							<h2 className="text-3xl font-bold text-gray-900 mb-12">Authors Love Get Lost</h2>
							<Card className="border-0 shadow-lg">
								<CardContent className="p-8">
									<p className="text-lg text-gray-700 italic mb-6">
										"Get Lost completely transformed my manuscript. The insights on pacing and character development
										were exactly what I needed. My book is now with a major publisher!"
									</p>
									<div className="flex items-center justify-center">
										<div>
											<p className="font-semibold text-gray-900">Sarah Mitchell</p>
											<p className="text-sm text-gray-600">Bestselling Author of "The Last Chapter"</p>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					</div>
				</section>

				{/* CTA Section */}
				<section className="py-20">
					<div className="container mx-auto px-4">
						<div className="max-w-4xl mx-auto">
							<Card className="bg-gradient-to-r from-purple-600 to-purple-700 border-0">
								<CardContent className="p-12 text-center">
									<h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
										Ready to Transform Your Manuscript?
									</h2>
									<p className="text-purple-100 mb-8 max-w-2xl mx-auto text-lg">
										Join thousands of authors who've improved their books with Get Lost.
										Start your journey to publication success today.
									</p>
									<Link href="/api/auth/signin">
										<Button size="lg" className="bg-white text-purple-600 hover:bg-gray-100 px-8">
											Get Your Report Now
											<ArrowRight className="ml-2 h-4 w-4" />
										</Button>
									</Link>
									<div className="flex items-center justify-center gap-8 mt-8 text-white/90">
										<div className="flex items-center gap-2">
											<CheckCircle className="h-5 w-5" />
											<span className="text-sm">No credit card required</span>
										</div>
										<div className="flex items-center gap-2">
											<CheckCircle className="h-5 w-5" />
											<span className="text-sm">5 minute analysis</span>
										</div>
										<div className="flex items-center gap-2">
											<CheckCircle className="h-5 w-5" />
											<span className="text-sm">Instant results</span>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					</div>
				</section>

				{/* Footer */}
				<footer className="border-t border-gray-200 bg-gray-50">
					<div className="container mx-auto px-4 py-12">
						<div className="grid md:grid-cols-4 gap-8">
							<div>
								<div className="flex items-center space-x-2 mb-4">
									<BookOpen className="h-6 w-6 text-purple-600" />
									<span className="text-lg font-semibold text-gray-900">Get Lost</span>
								</div>
								<p className="text-sm text-gray-600">
									Professional manuscript analysis powered by AI, designed for serious authors.
								</p>
							</div>
							<div>
								<h3 className="font-semibold text-gray-900 mb-4">Product</h3>
								<ul className="space-y-2 text-sm text-gray-600">
									<li><Link href="#" className="hover:text-gray-900">Features</Link></li>
									<li><Link href="#" className="hover:text-gray-900">Pricing</Link></li>
									<li><Link href="#" className="hover:text-gray-900">Sample Report</Link></li>
								</ul>
							</div>
							<div>
								<h3 className="font-semibold text-gray-900 mb-4">Company</h3>
								<ul className="space-y-2 text-sm text-gray-600">
									<li><Link href="#" className="hover:text-gray-900">About</Link></li>
									<li><Link href="#" className="hover:text-gray-900">Blog</Link></li>
									<li><Link href="#" className="hover:text-gray-900">Contact</Link></li>
								</ul>
							</div>
							<div>
								<h3 className="font-semibold text-gray-900 mb-4">Legal</h3>
								<ul className="space-y-2 text-sm text-gray-600">
									<li><Link href="#" className="hover:text-gray-900">Privacy</Link></li>
									<li><Link href="#" className="hover:text-gray-900">Terms</Link></li>
									<li><Link href="#" className="hover:text-gray-900">Cookie Policy</Link></li>
								</ul>
							</div>
						</div>
						<div className="mt-8 pt-8 border-t border-gray-200">
							<p className="text-center text-sm text-gray-600">
								© 2024 Get Lost. All rights reserved.
							</p>
						</div>
					</div>
				</footer>
			</div>
		</HydrateClient>
	);
}