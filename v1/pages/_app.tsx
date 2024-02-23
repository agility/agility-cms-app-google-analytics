import "@/styles/globals.css"
import "@agility/plenum-ui/dist/tailwind.css"
import { Mulish } from "next/font/google"
import type { AppProps } from "next/app"
import Head from "next/head"

const mulish = Mulish({ subsets: ["latin"] })

export default function App({ Component, pageProps }: AppProps) {
	return (
		<div className={mulish.className}>
			<Component {...pageProps} />
		</div>
	)
}
