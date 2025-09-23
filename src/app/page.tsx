import Link from "next/link";
import { ArrowRight, BookOpen, FileText, Sparkles, Zap, Shield, BarChart3, CheckCircle, Clock, Users, Award } from "lucide-react";

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
									<BookOpen className="h-6 w-6 text-orange-600" />
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
											<Button className="bg-orange-600 hover:bg-orange-700 text-white">
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
						<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 text-orange-700 text-sm font-medium mb-8">
							<Sparkles className="h-4 w-4" />
							AI-Enhanced Manuscript Analysis
						</div>
						<h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
							Transform Your Manuscript
							<span className="block text-orange-600">Into Your Best Work</span>
						</h1>
						<p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
							Get comprehensive, AI-enhanced feedback on your book. Our expert team combines
							advanced AI with human insight to deliver actionable recommendations.
						</p>
						<div className="flex flex-col sm:flex-row gap-4 justify-center">
							<Link href="/api/auth/signin">
								<Button size="lg" className="bg-cyan-600 hover:bg-cyan-700 text-white px-8">
									Start Your Analysis
									<ArrowRight className="ml-2 h-4 w-4" />
								</Button>
							</Link>
							<Button size="lg" variant="outline" className="border-gray-300">
								View Sample Report
							</Button>
						</div>
						<p className="text-sm text-gray-500 mt-8">
							Professional manuscript analysis • 1-3 day turnaround
						</p>
					</div>
				</section>

				{/* Transformation Visual Section */}
				<section className="py-20 bg-gradient-to-b from-orange-50 to-white">
					<div className="container mx-auto px-4">
						<div className="max-w-5xl mx-auto">
							<div className="text-center mb-12">
								<h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
									From Manuscript to Masterpiece
								</h2>
								<p className="text-gray-600 max-w-2xl mx-auto">
									Watch your manuscript transform into a comprehensive analysis report
								</p>
							</div>

							{/* Placeholder for transformation visual */}
							<div className="flex items-center justify-center gap-8 md:gap-16">
								<div className="text-center">
									<div className="w-32 h-40 bg-gray-100 rounded-lg border-2 border-gray-300 flex items-center justify-center mb-4">
										<FileText className="h-16 w-16 text-gray-400" />
									</div>
									<p className="text-sm font-medium text-gray-700">Your Manuscript</p>
								</div>

								<div className="flex flex-col items-center">
									<ArrowRight className="h-8 w-8 text-orange-600 animate-pulse" />
									<p className="text-xs text-orange-600 font-medium mt-2">AI + Human Analysis</p>
								</div>

								<div className="text-center">
									<div className="w-32 h-40 bg-gradient-to-br from-orange-100 to-orange-50 rounded-lg border-2 border-orange-300 flex items-center justify-center mb-4">
										<BarChart3 className="h-16 w-16 text-orange-600" />
									</div>
									<p className="text-sm font-medium text-gray-700">Your Report</p>
								</div>
							</div>

							<p className="text-center text-gray-500 text-sm mt-8">
								Space reserved for transformation artwork
							</p>
						</div>
					</div>
				</section>

				{/* Features Grid */}
				<section id="features" className="py-20">
					<div className="container mx-auto px-4">
						<div className="text-center mb-16">
							<h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
								Everything Authors Need to Succeed
							</h2>
							<p className="text-gray-600 max-w-2xl mx-auto">
								Our AI-enhanced analysis examines every aspect of your manuscript with both technological precision and human expertise
							</p>
						</div>

						<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
							<Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
								<CardContent className="p-6">
									<div className="h-12 w-12 rounded-lg bg-orange-100 flex items-center justify-center mb-4">
										<FileText className="h-6 w-6 text-orange-600" />
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
										<Users className="h-6 w-6 text-green-600" />
									</div>
									<h3 className="text-lg font-semibold text-gray-900 mb-2">Human + AI Insights</h3>
									<p className="text-gray-600">
										Combining AI analysis with human expertise for nuanced, actionable feedback.
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
										Your manuscript remains private and is deleted after report completion. Only you have access.
									</p>
								</CardContent>
							</Card>
						</div>
					</div>
				</section>

				{/* Pricing Section */}
				<section id="pricing" className="bg-gray-50 py-20">
					<div className="container mx-auto px-4">
						<div className="text-center mb-12">
							<h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
								Simple, Transparent Pricing
							</h2>
							<p className="text-gray-600 max-w-2xl mx-auto">
								One comprehensive report, one fair price
							</p>
						</div>

						<div className="max-w-md mx-auto">
							<Card className="border-2 border-orange-200 shadow-lg">
								<CardContent className="p-8">
									<div className="text-center mb-6">
										<h3 className="text-2xl font-bold text-gray-900 mb-2">Manuscript Analysis Report</h3>
										<div className="flex items-baseline justify-center gap-1">
											<span className="text-5xl font-bold text-orange-600">$39</span>
											<span className="text-gray-600">USD</span>
										</div>
										<p className="text-sm text-gray-500 mt-2">per manuscript</p>
									</div>

									<ul className="space-y-3 mb-8">
										<li className="flex items-start gap-3">
											<CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
											<span className="text-gray-700">Comprehensive 20+ page report</span>
										</li>
										<li className="flex items-start gap-3">
											<CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
											<span className="text-gray-700">AI-enhanced analysis with human review</span>
										</li>
										<li className="flex items-start gap-3">
											<CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
											<span className="text-gray-700">Structure, pacing, and character analysis</span>
										</li>
										<li className="flex items-start gap-3">
											<CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
											<span className="text-gray-700">Market positioning insights</span>
										</li>
										<li className="flex items-start gap-3">
											<CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
											<span className="text-gray-700">Actionable recommendations</span>
										</li>
										<li className="flex items-start gap-3">
											<Clock className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
											<span className="text-gray-700">Delivered in 1-3 business days</span>
										</li>
									</ul>

									<Link href="/api/auth/signin" className="block">
										<Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white" size="lg">
											Get Your Report
											<ArrowRight className="ml-2 h-4 w-4" />
										</Button>
									</Link>

									<p className="text-xs text-gray-500 text-center mt-4">
										Secure payment via Stripe
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
									From submission to insights in just a few days
								</p>
							</div>

							<div className="space-y-12">
								<div className="flex gap-6 items-start">
									<div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
										<span className="text-orange-600 font-bold">1</span>
									</div>
									<div>
										<h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Your Manuscript</h3>
										<p className="text-gray-600">
											Simply upload your book in any format - DOCX, PDF, EPUB, or plain text. Complete the secure checkout process.
										</p>
									</div>
								</div>

								<div className="flex gap-6 items-start">
									<div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
										<span className="text-orange-600 font-bold">2</span>
									</div>
									<div>
										<h3 className="text-lg font-semibold text-gray-900 mb-2">AI-Enhanced Analysis</h3>
										<p className="text-gray-600">
											Our AI analyzes your manuscript while our team reviews key elements, ensuring both technological precision and human insight.
										</p>
									</div>
								</div>

								<div className="flex gap-6 items-start">
									<div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
										<span className="text-orange-600 font-bold">3</span>
									</div>
									<div>
										<h3 className="text-lg font-semibold text-gray-900 mb-2">Receive Your Report</h3>
										<p className="text-gray-600">
											Within 1-3 business days, receive your comprehensive report with detailed feedback, market insights, and specific recommendations for improvement.
										</p>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Testimonial Section */}
				<section className="bg-orange-50 py-20">
					<div className="container mx-auto px-4">
						<div className="max-w-3xl mx-auto text-center">
							<h2 className="text-3xl font-bold text-gray-900 mb-12">What Authors Are Saying</h2>
							<Card className="border-0 shadow-lg">
								<CardContent className="p-8">
									<p className="text-lg text-gray-700 italic mb-6">
										"Get Lost completely transformed my manuscript. The insights on pacing and character development
										were exactly what I needed. The combination of AI analysis and human expertise made all the difference."
									</p>
									<div className="flex items-center justify-center">
										<div>
											<p className="font-semibold text-gray-900">Sarah Mitchell</p>
											<p className="text-sm text-gray-600">Author of "The Last Chapter"</p>
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
							<Card className="bg-gradient-to-r from-orange-600 to-orange-700 border-0">
								<CardContent className="p-12 text-center">
									<h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
										Ready to Transform Your Manuscript?
									</h2>
									<p className="text-orange-100 mb-8 max-w-2xl mx-auto text-lg">
										Get professional insights that will elevate your writing.
										Start your journey to publication success today.
									</p>
									<Link href="/api/auth/signin">
										<Button size="lg" className="bg-white text-orange-600 hover:bg-gray-100 px-8">
											Get Your Report - $39
											<ArrowRight className="ml-2 h-4 w-4" />
										</Button>
									</Link>
									<div className="flex items-center justify-center gap-8 mt-8 text-white/90">
										<div className="flex items-center gap-2">
											<Clock className="h-5 w-5" />
											<span className="text-sm">1-3 day turnaround</span>
										</div>
										<div className="flex items-center gap-2">
											<Award className="h-5 w-5" />
											<span className="text-sm">Professional analysis</span>
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
									<BookOpen className="h-6 w-6 text-orange-600" />
									<span className="text-lg font-semibold text-gray-900">Get Lost</span>
								</div>
								<p className="text-sm text-gray-600">
									Professional manuscript analysis combining AI technology with human expertise.
								</p>
							</div>
							<div>
								<h3 className="font-semibold text-gray-900 mb-4">Product</h3>
								<ul className="space-y-2 text-sm text-gray-600">
									<li><Link href="#features" className="hover:text-gray-900">Features</Link></li>
									<li><Link href="#pricing" className="hover:text-gray-900">Pricing</Link></li>
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