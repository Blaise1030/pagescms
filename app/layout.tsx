import { Toaster } from "@/components/ui/sonner"
import { Providers } from "@/components/providers";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Geist } from "next/font/google";
import { getBaseUrl } from "@/lib/base-url";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";
import "./globals.css";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});
const appUrl = getBaseUrl();
const socialImage = "/images/social-card.png";
export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    template: `%s | ${APP_NAME}`,
    default: APP_NAME,
  },
  description: APP_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: appUrl,
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: [
      {
        url: socialImage,
        width: 1200,
        height: 630,
        alt: `${APP_NAME} social card`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: [socialImage],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {  
	return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          geist.variable,
          jetbrainsMono.variable,
        )}
      >
        <Providers user={null}>
          {children}
        </Providers>
        <Toaster/>
      </body>
    </html>
  );
}
