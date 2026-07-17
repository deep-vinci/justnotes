import Script from "next/script";
import "./globals.css";

export const metadata = {
  title: "Mono Editor",
  description: "A minimal notes editor",
};

const THEME_INIT_SCRIPT = `try {
  var d = JSON.parse(localStorage.getItem("mono-editor-data") || "null");
  if (d && d.theme === "dark") document.documentElement.classList.add("dark");
} catch (e) {}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}
