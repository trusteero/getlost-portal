import Link from "next/link";
import { ArrowRight, BookOpen, FileText, Sparkles, Zap, Shield, BarChart3, CheckCircle, Clock, Users, Award } from "lucide-react";

import { getSession } from "@/server/auth";
import { HydrateClient, api } from "@/trpc/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import SignOutButton from "@/components/signout-button";

// Force dynamic rendering since we need auth check
export const dynamic = 'force-dynamic';

export default async function Home() {
	let session = null;
	try {
		session = await getSession();
	} catch (error) {
		// During build or if auth fails, treat as no session
		session = null;
	}

	return (
		<HydrateClient>
			<div className="min-h-screen bg-white">
				{/* Navigation */}
				<nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
					<div className="container mx-auto px-4">
						<div className="flex items-center justify-between h-16">
							<div className="flex items-center space-x-8">
								<Link href="/" className="flex items-center space-x-2">
									<img src="/logo256.png" alt="Get Lost" className="h-8 w-8" />
									<span className="text-xl font-semibold text-orange-600">Get Lost</span>
								</Link>
								<div className="hidden md:flex space-x-6">
									<Link href="#features" className="text-gray-600 hover:text-gray-900 transition">Features</Link>
									<Link href="#how-it-works" className="text-gray-600 hover:text-gray-900 transition">How it works</Link>
									<Link href="#pricing" className="text-gray-600 hover:text-gray-900 transition">Pricing</Link>
								</div>
							</div>
							<div className="flex items-center space-x-4">
								{session?.user ? (
									<>
										<Link href="/dashboard">
											<Button variant="ghost" className="text-gray-600 hover:text-gray-900">
												Dashboard
											</Button>
										</Link>
										<SignOutButton />
									</>
								) : (
									<>
										<Link href="/login">
											<Button variant="ghost" className="text-gray-600 hover:text-gray-900">
												Sign in
											</Button>
										</Link>
										<Link href="/signup">
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
				<section className="relative py-12 md:py-16" style={{ backgroundImage: 'url(/booksborder.png)', backgroundRepeat: 'repeat-x', backgroundPosition: 'top', backgroundSize: 'auto 320px' }}>
					<div className="container mx-auto px-4">
						<div className="max-w-4xl mx-auto text-center">
							<h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 leading-tight">
								Every book has its own
								<span className="block">unique <span className="text-orange-600" style={{ textShadow: '0 0 4px rgba(255, 255, 255, 1), 0 0 8px rgba(255, 255, 255, 0.9)' }}>fingerprint</span></span>
							</h1>
							<p className="text-xl text-gray-600 mb-6 max-w-2xl mx-auto leading-relaxed">
								Your story is unique, and your readers are waiting. We uncover what makes your book special,
								map the audiences most likely to connect, and guide you with strategies that turn insight into action.
								It all begins with your book's digital fingerprint.
							</p>
							<div className="mb-8">
								<img
									src="/booktoreport.png"
									alt="Manuscript to Report Transformation"
									className="mx-auto my-4 md:my-16 w-2/3 md:w-2/4 max-w-xl h-auto"
								/>
							</div>
							<div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
								<Link href="/signup">
									<Button size="lg" className="bg-cyan-600 hover:bg-cyan-700 text-white px-8 w-auto">
										Start Your Analysis
										<ArrowRight className="ml-2 h-4 w-4" />
									</Button>
								</Link>
								<Button size="lg" variant="outline" className="border-gray-300 w-auto px-8">
									View Sample Report
								</Button>
							</div>
							<p className="text-sm text-gray-500 mt-6">
								Professional book reports • 1-3 day turnaround
							</p>
						</div>
					</div>
				</section>


				{/* Features Grid */}
				<section id="features" className="py-12">
					<div className="container mx-auto px-4">
						<div className="text-center mb-10">
							<h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
								What You Get
							</h2>
							<p className="text-gray-600 max-w-2xl mx-auto">
								Our reports give you everything you need to understand and position your book
							</p>
						</div>

						<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
							<Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
								<CardContent className="p-6">
									<div className="h-12 w-12 rounded-lg bg-orange-100 flex items-center justify-center mb-4">
										<Users className="h-6 w-6 text-orange-600" />
									</div>
									<h3 className="text-lg font-semibold text-gray-900 mb-2">Know Your Readers</h3>
									<p className="text-gray-600">
										No more guessing: know exactly who your readers are and what they're looking for.
									</p>
								</CardContent>
							</Card>


							<Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
								<CardContent className="p-6">
									<div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
										<BarChart3 className="h-6 w-6 text-green-600" />
									</div>
									<h3 className="text-lg font-semibold text-gray-900 mb-2">Market Positioning</h3>
									<p className="text-gray-600">
										Positioning that sets you apart in a crowded market and helps you stand out.
									</p>
								</CardContent>
							</Card>

							<Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
								<CardContent className="p-6">
									<div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
										<Award className="h-6 w-6 text-purple-600" />
									</div>
									<h3 className="text-lg font-semibold text-gray-900 mb-2">Pitch Confidence</h3>
									<p className="text-gray-600">
										Confidence when pitching to agents, publishers, and readers with data-backed insights.
									</p>
								</CardContent>
							</Card>

							<Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
								<CardContent className="p-6">
									<div className="h-12 w-12 rounded-lg bg-pink-100 flex items-center justify-center mb-4">
										<Zap className="h-6 w-6 text-pink-600" />
									</div>
									<h3 className="text-lg font-semibold text-gray-900 mb-2">Marketing Strategy</h3>
									<p className="text-gray-600">
										Tailored guidance you can use in campaigns and promotions to reach your ideal readers.
									</p>
								</CardContent>
							</Card>

							<Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
								<CardContent className="p-6">
									<div className="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center mb-4">
										<BookOpen className="h-6 w-6 text-indigo-600" />
									</div>
									<h3 className="text-lg font-semibold text-gray-900 mb-2">Built for Authors</h3>
									<p className="text-gray-600">
										Built with authors, for authors. We're partnering across genres to shape the future of discovery.
									</p>
								</CardContent>
							</Card>

							<Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
								<CardContent className="p-6">
									<div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
										<Shield className="h-6 w-6 text-blue-600" />
									</div>
									<h3 className="text-lg font-semibold text-gray-900 mb-2">Secure & Confidential</h3>
									<p className="text-gray-600">
										Your manuscript is stored securely and treated with utmost confidentiality. We prioritize your privacy.
									</p>
								</CardContent>
							</Card>
						</div>
					</div>
				</section>


				{/* Pricing Section */}
				<section id="pricing" className="py-12">
					<div className="container mx-auto px-4">
						<div className="text-center mb-12">
							<h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
								Choose Your Plan
							</h2>
							<p className="text-gray-600 max-w-2xl mx-auto mb-8">
								Professional book reports that scale with your writing journey. Get feedback early and often to improve faster.
							</p>
						</div>

						<div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
							{/* Starter Plan */}
							<Card className="relative border shadow-lg hover:shadow-xl transition-shadow flex flex-col">
								<CardContent className="p-6 flex flex-col flex-grow">
									<div className="text-center mb-6">
										<h3 className="text-xl font-bold text-gray-900 mb-2">Starter</h3>
										<div className="flex items-baseline justify-center gap-1">
											<span className="text-4xl font-bold text-gray-900">$39</span>
										</div>
										<p className="text-sm text-gray-500 mt-2">per report</p>
									</div>

									<ul className="space-y-3 mb-8 flex-grow">
										<li className="flex items-start gap-3">
											<CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
											<span className="text-gray-700 text-sm">1 book report</span>
										</li>
										<li className="flex items-start gap-3">
											<CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
											<span className="text-gray-700 text-sm">20+ page detailed report</span>
										</li>
										<li className="flex items-start gap-3">
											<CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
											<span className="text-gray-700 text-sm">1-3 day turnaround</span>
										</li>
										<li className="flex items-start gap-3">
											<CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
											<span className="text-gray-700 text-sm">AI + human review</span>
										</li>
									</ul>

									<Link href="/api/auth/signin" className="block mt-auto">
										<Button className="w-full bg-gray-600 hover:bg-gray-700 text-white" size="lg">
											Get Started
										</Button>
									</Link>
								</CardContent>
							</Card>

							{/* Author Plan - Popular */}
							<Card className="relative border-2 border-orange-300 shadow-xl hover:shadow-2xl transition-shadow flex flex-col">
								{/* Popular badge */}
								<div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
									<span className="bg-orange-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
										MOST POPULAR
									</span>
								</div>

								<CardContent className="p-6 pt-8 flex flex-col flex-grow">
									<div className="text-center mb-6">
										<h3 className="text-xl font-bold text-gray-900 mb-2">Author</h3>
										<div className="flex items-baseline justify-center gap-1">
											<span className="text-5xl font-bold text-orange-600">$129</span>
										</div>
										<p className="text-sm text-gray-500 mt-2">4 reports bundle</p>
										<div className="mt-2 bg-green-50 border border-green-200 rounded-full px-3 py-1 inline-block">
											<p className="text-sm text-green-700 font-semibold">Save $27</p>
										</div>
									</div>

									<ul className="space-y-3 mb-8 flex-grow">
										<li className="flex items-start gap-3">
											<CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
											<span className="text-gray-700 text-sm font-semibold">4 book reports</span>
										</li>
										<li className="flex items-start gap-3">
											<CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
											<span className="text-gray-700 text-sm">Priority processing</span>
										</li>
										<li className="flex items-start gap-3">
											<CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
											<span className="text-gray-700 text-sm">12 month validity</span>
										</li>
										<li className="flex items-start gap-3">
											<CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
											<span className="text-gray-700 text-sm">Email support</span>
										</li>
										<li className="flex items-start gap-3">
											<CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
											<span className="text-gray-700 text-sm">Perfect for iterative writing</span>
										</li>
									</ul>

									<Link href="/api/auth/signin" className="block mt-auto">
										<Button className="w-full bg-orange-600 hover:bg-orange-700 text-white" size="lg">
											Best Value
											<ArrowRight className="ml-2 h-4 w-4" />
										</Button>
									</Link>
								</CardContent>
							</Card>

							{/* Business Plan */}
							<Card className="relative border shadow-lg hover:shadow-xl transition-shadow flex flex-col">
								<CardContent className="p-6 flex flex-col flex-grow">
									<div className="text-center mb-6">
										<h3 className="text-xl font-bold text-gray-900 mb-2">Business</h3>
										<div className="flex items-baseline justify-center gap-1">
											<span className="text-4xl font-bold text-gray-900">$349</span>
										</div>
										<p className="text-sm text-gray-500 mt-2">12 reports bundle</p>
										<p className="text-xs text-gray-600 mt-1">+ $29 per additional</p>
									</div>

									<ul className="space-y-3 mb-8 flex-grow">
										<li className="flex items-start gap-3">
											<CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
											<span className="text-gray-700 text-sm font-semibold">12 book reports</span>
										</li>
										<li className="flex items-start gap-3">
											<CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
											<span className="text-gray-700 text-sm">Dedicated support</span>
										</li>
										<li className="flex items-start gap-3">
											<CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
											<span className="text-gray-700 text-sm">Volume discounts available</span>
										</li>
									</ul>

									<Link href="/api/auth/signin" className="block mt-auto">
										<Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white" size="lg">
											For Teams
										</Button>
									</Link>
								</CardContent>
							</Card>
						</div>

						<p className="text-xs text-gray-500 text-center mt-8">
							All plans include comprehensive AI-enhanced reports with human review • Secure payment via Stripe
						</p>

						<div className="text-center mt-6">
							<p className="text-sm text-gray-600">
								Need a custom plan? Contact us at{" "}
								<a href="mailto:info@getlost.ink" className="text-orange-600 hover:text-orange-700 underline">
									info@getlost.ink
								</a>
							</p>
						</div>
					</div>
				</section>

				{/* How it works */}
				<section id="how-it-works" className="py-12">
					<div className="container mx-auto px-4">
						<div className="max-w-4xl mx-auto">
							<div className="text-center mb-10">
								<h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
									How it works
								</h2>
								<p className="text-gray-600">
									From submission to insights in minutes
								</p>
							</div>

							<div className="space-y-8">
								<div className="flex gap-6 items-start">
									<div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
										<span className="text-orange-600 font-bold">1</span>
									</div>
									<div>
										<h3 className="text-lg font-semibold text-gray-900 mb-2">Upload</h3>
										<p className="text-gray-600">
											Upload your manuscript with confidence. Security and privacy come first.
										</p>
									</div>
								</div>

								<div className="flex gap-6 items-start">
									<div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
										<span className="text-orange-600 font-bold">2</span>
									</div>
									<div>
										<h3 className="text-lg font-semibold text-gray-900 mb-2">Fingerprint</h3>
										<p className="text-gray-600">
											We create a digital fingerprint that maps your story across our advanced sub-genre system.
										</p>
									</div>
								</div>

								<div className="flex gap-6 items-start">
									<div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
										<span className="text-orange-600 font-bold">3</span>
									</div>
									<div>
										<h3 className="text-lg font-semibold text-gray-900 mb-2">Insights</h3>
										<p className="text-gray-600">
											Your book, translated for the market. See how your story connects, where it fits, and how to reach the readers who will love it.
										</p>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Testimonial Section */}
				<section className="bg-orange-50 py-12">
					<div className="container mx-auto px-4">
						<div className="max-w-3xl mx-auto text-center">
							<h2 className="text-3xl font-bold text-gray-900 mb-8">What Authors Are Saying</h2>
							<Card className="border-0 shadow-lg">
								<CardContent className="p-8">
									<p className="text-lg text-gray-700 italic mb-6">
										"Get Lost revealed my book's perfect audience—readers who love Nordic noir with a romantic twist.
										The fingerprint analysis showed me exactly which keywords and categories to target on Amazon.
										Within weeks of implementing their marketing strategies, I found my tribe of readers who were
										hungry for exactly what I'd written."
									</p>
									<div className="flex items-center justify-center">
										<div>
											<p className="font-semibold text-gray-900">Jim Crumbler</p>
											<p className="text-sm text-gray-600">Author of "Northern Hearts: A Love Letter to Helsinki"</p>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					</div>
				</section>

				{/* CTA Section */}
				<section className="py-16">
					<div className="container mx-auto px-4">
						<div className="max-w-4xl mx-auto text-center">
							<h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
								Ready to Transform Your Manuscript?
							</h2>
							<p className="text-gray-600 mb-8 max-w-2xl mx-auto text-lg">
								Get professional insights that will elevate your writing.
								Start your journey to publication success today.
							</p>
							<Link href="/signup">
								<Button size="lg" className="bg-orange-600 text-white hover:bg-orange-700 px-8">
									Start Your Analysis
									<ArrowRight className="ml-2 h-4 w-4" />
								</Button>
							</Link>
							<div className="flex items-center justify-center gap-8 mt-8 text-gray-500">
								<div className="flex items-center gap-2">
									<Clock className="h-5 w-5" />
									<span className="text-sm">1-3 day turnaround</span>
								</div>
								<div className="flex items-center gap-2">
									<Award className="h-5 w-5" />
									<span className="text-sm">Professional analysis</span>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Footer */}
				<footer className="border-t border-gray-200 bg-gray-50">
					<div className="container mx-auto px-4 py-8">
						<div className="text-center">
							<div className="flex items-center justify-center space-x-3 mb-4">
								<img src="/logo256.png" alt="Get Lost" className="h-8 w-8" />
								<span className="text-2xl font-bold text-orange-600">Get Lost</span>
							</div>
							<p className="text-sm text-gray-600 mb-2">
								© 2025 Get Lost. All rights reserved.
							</p>
							<p className="text-sm text-gray-600">
								Contact: <a href="mailto:info@getlost.ink" className="text-orange-600 hover:text-orange-700">info@getlost.ink</a>
							</p>
						</div>
					</div>
				</footer>
			</div>
		</HydrateClient>
	);
}