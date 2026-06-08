import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocRunner Verified Docs",
  description: "Public leaderboard for projects that test their documentation.",
};

interface RootLayoutProps {
  children: ReactNode;
}

/**
 * Renders the shared dashboard document shell.
 * @param props Page content.
 * @returns Root HTML layout.
 */
export default function RootLayout({ children }: RootLayoutProps): ReactNode {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">
              DR
            </span>
            <span>DocRunner</span>
          </a>
          <a
            className="github-link"
            href="https://github.com/eshaanag/DocRunner"
          >
            GitHub
          </a>
        </header>
        {children}
      </body>
    </html>
  );
}
