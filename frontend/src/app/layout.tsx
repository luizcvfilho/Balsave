import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import type { Metadata, Viewport } from "next";
import symbol from "../../../assets/balsave-symbol.svg";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/playfair-display/wght.css";
import { Header } from "../components/layout/header";
import { SessionViewProvider } from "../components/layout/session-view-provider";
import { authEnabled, sessionView } from "../data/session";
import { BalsaveThemeProvider } from "../theme/theme-provider";
import "./globals.css";

export const viewport: Viewport = { viewportFit: "cover" };

export const metadata: Metadata = {
  title: "Balsave",
  description: "Controle, patrimônio e evolução.",
  icons: {
    icon: [{ url: symbol.src, type: "image/svg+xml" }],
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
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <InitColorSchemeScript attribute='[data-theme="%s"]' />
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
