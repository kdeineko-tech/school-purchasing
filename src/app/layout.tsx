import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Назва вкладки — «<сторінка> · School Purchasing»; сторінки задають лише свою частину (metadata.title).
export const metadata: Metadata = {
  title: { default: "School Purchasing", template: "%s · School Purchasing" },
  description: "School purchase requests and approvals",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Тема з перемикача; без cookie атрибута немає, і тему задає система (globals.css).
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
