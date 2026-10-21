import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import NavBar from "@/components/NavBar";

export const metadata = {
  title: "Cab Booking",
  description: "Book a ride in a few taps.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased [color-scheme:light] dark:bg-zinc-950 dark:text-zinc-100 dark:[color-scheme:dark]">
          <a
            href="#content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[1200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-lg focus:ring-2 focus:ring-indigo-600"
          >
            Skip to content
          </a>
          <AuthProvider>
            <NavBar />
            <div id="content">{children}</div>
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}