import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import { Suspense } from "react";
import NavBar from "@/components/NavBar";

export const metadata = {
  title: "Cab Booking",
  description: "Book a ride",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-black focus:ring-2 focus:ring-black"
        >
          Skip to content
        </a>
        <AuthProvider>
          <Suspense fallback={<div className="h-16" aria-hidden="true" />}>
            <NavBar />
          </Suspense>
          <div id="content">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}
