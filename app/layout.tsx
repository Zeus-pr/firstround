import type { Metadata } from "next";
import "@fontsource-variable/google-sans";
import { Mast } from "@/components/Mast";
import "./globals.css";

export const metadata: Metadata = {
  title: "First Round",
  description:
    "A letter to the person who can say yes. You read it. It leaves from your Gmail.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Mast />
        {children}
      </body>
    </html>
  );
}
