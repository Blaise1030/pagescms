import { ThemeProvider } from "@/components/theme-provider";
import { MarketingChrome } from "@/components/marketing/marketing-chrome";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      forcedTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <div className="marketing flex min-h-screen flex-col bg-background">
        <MarketingChrome>{children}</MarketingChrome>
      </div>
    </ThemeProvider>
  );
}
