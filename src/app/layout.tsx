import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ReactNode } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Adaptive Interview Engine",
  description: "AI-powered adaptive technical interviews",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        <meta name="theme-color" content="#171717" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Interviews" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link
          rel="apple-touch-startup-image"
          href="/apple-touch-startup-image-1170x2532.png"
          media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/apple-touch-startup-image-1290x2796.png"
          media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/apple-touch-startup-image-1668x2388.png"
          media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/apple-touch-startup-image-2048x2732.png"
          media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                var production = ${JSON.stringify(process.env.NODE_ENV === "production")};
                if (production) {
                  window.addEventListener('load', function () {
                    navigator.serviceWorker.register('/sw.js').catch(function (err) {
                      console.error('Service worker registration failed:', err);
                    });
                  });
                } else {
                  // Development chunks keep their URLs across edits, and the worker caches
                  // /_next/static/* cache-first — so a device that opened the page once keeps
                  // running that bundle no matter what is rebuilt. Unregister here, drop the
                  // caches it made, and reload once: this page's own scripts already came
                  // from that cache, so only the next document is the current source.
                  var clearWorker = navigator.serviceWorker.getRegistrations()
                    .then(function (registrations) {
                      return Promise.all(registrations.map(function (registration) {
                        return registration.unregister();
                      }));
                    })
                    .then(function () {
                      if (!window.caches) return;
                      return caches.keys().then(function (keys) {
                        return Promise.all(keys.map(function (key) { return caches.delete(key); }));
                      });
                    })
                    .catch(function () {});
                  if (navigator.serviceWorker.controller) {
                    clearWorker.then(function () {
                      if (sessionStorage.getItem('sw-cleared')) return;
                      sessionStorage.setItem('sw-cleared', '1');
                      location.reload();
                    });
                  }
                }
              }
            `,
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
