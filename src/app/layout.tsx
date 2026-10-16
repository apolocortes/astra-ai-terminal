import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ASTRA TERMINAL — AI Institutional Trading Engine",
  description: "Terminal institucional de inteligência quantitativa com motor GPT-6 Astra em tempo real para Day Trade de alta precisão.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="bg-[#060910] text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}