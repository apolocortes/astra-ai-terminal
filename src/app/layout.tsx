import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ASTRA LAB — Simulação transparente de estratégias",
  description:
    "Laboratório de simulação spot com dados Coinbase, custos, perdas e evidências exportáveis. Sem ordens reais ou promessa de rentabilidade.",
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
