import "@/styles/globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "@/trpc/react";
import { Providers } from "./providers";

export const metadata: Metadata = {
	title: "Get Lost - Professional Manuscript Analysis for Authors",
	description: "Transform your manuscript into your best work with AI-enhanced analysis and human expertise. Get comprehensive feedback in 1-3 days.",
	icons: [
		{ rel: "icon", type: "image/png", sizes: "96x96", url: "/favicon-96x96.png" },
		{ rel: "icon", type: "image/svg+xml", url: "/favicon.svg" },
		{ rel: "shortcut icon", url: "/favicon.ico" },
		{ rel: "apple-touch-icon", sizes: "180x180", url: "/apple-touch-icon.png" },
	],
	manifest: "/site.webmanifest",
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" className={`${geist.variable}`}>
			<body>
				<TRPCReactProvider>
					<Providers>{children}</Providers>
				</TRPCReactProvider>
			</body>
		</html>
	);
}
