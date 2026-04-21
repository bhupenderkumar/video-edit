import type { Metadata } from "next";
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
};

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
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
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card">
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
                  Local Mode
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Groq Free Tier • FFmpeg Local
                </p>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="ml-64 flex-1">
            <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
