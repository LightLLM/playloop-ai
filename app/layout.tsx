import type { Metadata } from "next";
import "./globals.css";
import "./game-enhancements.css";
import "./engine.css";

export const metadata: Metadata = {
  title: "PlayLoop AI — Describe it. Play it.",
  description: "Turn a game idea written in plain English into a playable 2D world.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
