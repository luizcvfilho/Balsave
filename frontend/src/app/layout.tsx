import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import type { Metadata } from "next";
import symbolDark from "../../../assets/balsave-symbol-dark.svg";
import symbolLight from "../../../assets/balsave-symbol-light.svg";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/playfair-display/wght.css";
import { Header } from "../components/layout/header";
import { hasPreviewSession } from "../data/preview-session";
import { BalsaveThemeProvider } from "../theme/theme-provider";
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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const signedIn = await hasPreviewSession();
  return (
    <html lang="pt-BR">
      <body>
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <BalsaveThemeProvider>
            <Header signedIn={signedIn} />
            {children}
          </BalsaveThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
