import { cookies } from "next/headers";
import "./globals.css";

export const metadata = {
  title: "Mono Editor",
  description: "A minimal notes editor",
};

export default async function RootLayout({ children }) {
  const theme = (await cookies()).get("theme")?.value === "dark" ? "dark" : "light";

  return (
    <html lang="en" className={theme === "dark" ? "dark" : undefined}>
      <body>{children}</body>
    </html>
  );
}
