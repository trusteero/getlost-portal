import { Suspense } from "react";
import SignInForm from "./signin-form";

export default function SignInPage() {
	return (
		<Suspense fallback={
			<main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
				<div className="container flex flex-col items-center justify-center gap-8 px-4 py-16">
					<h1 className="font-extrabold text-5xl tracking-tight sm:text-[5rem]">
						Get<span className="text-[hsl(280,100%,70%)]">Lost</span> Portal
					</h1>
					<div className="text-xl">Loading...</div>
				</div>
			</main>
		}>
			<SignInForm />
		</Suspense>
	);
}
