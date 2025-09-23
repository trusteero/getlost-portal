import "@/styles/globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "@/trpc/react";
import { Providers } from "./providers";

export const metadata: Metadata = {
	title: "Get Lost - Professional Manuscript Analysis for Authors",
	description: "Transform your manuscript into your best work with AI-enhanced analysis and human expertise. Get comprehensive feedback in 1-3 days.",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
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
