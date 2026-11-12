import type { Metadata } from "next";
import logo from "../../../assets/valora.svg";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/playfair-display/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Valora",
  description: "Controle, patrimônio e evolução.",
  icons: { icon: logo.src },
};

const systemTheme = `
  const theme = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => { document.documentElement.dataset.theme = theme.matches ? 'dark' : 'light'; };
  apply();
  theme.addEventListener('change', apply);
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: The script is a constant and applies the theme before the initial render. */}
        <script dangerouslySetInnerHTML={{ __html: systemTheme }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
