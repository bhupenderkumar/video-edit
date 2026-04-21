import type { Metadata } from "next";
import type { Viewport } from "next";
import "./globals.css";
import Link from "next/link";
import {
  Video,
  Upload,
  LayoutDashboard,
  User,
  ImagePlus,
} from "lucide-react";

export const metadata: Metadata = {
  title: "ClipAI — AI Video Editor for Small Business",
  description:
    "Upload your raw video. AI edits it for Instagram, YouTube, TikTok. Zero editing skills required.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ClipAI",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#09090b",
};

const navItems = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/photos", label: "Photos", icon: ImagePlus },
  { href: "/profile", label: "Brand", icon: User },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="flex min-h-screen flex-col lg:flex-row">
          {/* Desktop Sidebar — hidden on mobile */}
          <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card lg:flex">
            {/* Logo */}
            <div className="flex h-16 items-center gap-3 border-b border-border px-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <Video className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">ClipAI</h1>
                <p className="text-[11px] text-muted-foreground">
                  AI Video Editor
                </p>
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 space-y-1 px-3 py-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Footer */}
            <div className="border-t border-border p-4">
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs font-medium text-foreground">
                  AI Powered
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Groq LLM • Smart Editing
                </p>
              </div>
            </div>
          </aside>

          {/* Mobile Top Bar — visible only on mobile */}
          <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur-md lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Video className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="text-base font-bold tracking-tight">ClipAI</h1>
          </header>

          {/* Main Content */}
          <main className="flex-1 pb-20 lg:ml-64 lg:pb-0">
            <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">{children}</div>
          </main>

          {/* Mobile Bottom Tab Bar — visible only on mobile */}
          <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur-md safe-bottom lg:hidden">
            <div className="flex items-stretch justify-around">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-1 flex-col items-center gap-0.5 py-2 text-muted-foreground transition-colors active:text-primary"
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </body>
    </html>
  );
}
