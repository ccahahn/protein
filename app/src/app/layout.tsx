import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Protein",
  description: "Will your groceries make it to the end of the week?",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..600&family=DM+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md min-h-[85vh] bg-bg flex flex-col">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
