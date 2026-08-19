import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { Ambient } from "@/components/shell/ambient";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FinFut",
  description: "A caixa do casal — controle financeiro pessoal e leve.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${outfit.variable} h-full antialiased`}>
      <body className="min-h-full text-slate-800">
        <Ambient />
        {children}
      </body>
    </html>
  );
}
