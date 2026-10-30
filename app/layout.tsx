import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Onest alojada en el repositorio (variable, pesos 100-900, subconjunto latin): con next/font/google el build de Vercel
// descarga la tipografía desde Google Fonts y falla entero si esa descarga se cae (Module not found en font/google).
const onest = localFont({
  src: "./fonts/onest-latin-wght-normal.woff2",
  variable: "--font-onest",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kaizen Bigbuda",
  description: "Plataforma interna de mejora continua del área de Marketing — Bigbuda",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-CL" className={`${onest.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
