import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import type { Metadata } from "next";
import symbolDark from "../../../assets/balsave-symbol-dark.svg";
import symbolLight from "../../../assets/balsave-symbol-light.svg";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/playfair-display/wght.css";
import { Header } from "../components/layout/header";
import { SessionViewProvider } from "../components/layout/session-view-provider";
import { authEnabled, sessionView } from "../data/session";
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
  const { status, viewKey } = await sessionView();
  const configured = authEnabled();
  const content = <>
    <Header
      signedIn={status === "active"}
      showNavigation={status !== "unavailable"}
      showHomeSignIn={status === "anonymous"}
    />
    {children}
  </>;
  return (
    <html lang="pt-BR">
      <body>
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <BalsaveThemeProvider>
            {configured ? (
              <SessionViewProvider key={viewKey} viewKey={viewKey} sync={status !== "unavailable"}>
                {content}
              </SessionViewProvider>
            ) : content}
          </BalsaveThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
