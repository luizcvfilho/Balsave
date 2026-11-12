import type { Metadata } from "next";
import symbolDark from "../../../assets/balsave-symbol-dark.svg";
import symbolLight from "../../../assets/balsave-symbol-light.svg";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/playfair-display/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Balsave",
  description: "Controle, patrimônio e evolução.",
  icons: {
    icon: [
      { url: symbolLight.src, type: "image/svg+xml" },
      { url: symbolDark.src, type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
    ],
  },
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
