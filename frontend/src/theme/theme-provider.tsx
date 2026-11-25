"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import type { ReactNode } from "react";

const editorialFont = '"Playfair Display Variable", Georgia, serif';

const theme = createTheme({
  cssVariables: { colorSchemeSelector: '[data-theme="%s"]' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#19201d" },
        secondary: { main: "#246546" },
      },
    },
    dark: {
      palette: {
        primary: { main: "#f4f5f4" },
        secondary: { main: "#a6dbb9" },
      },
    },
  },
  typography: {
    fontFamily: '"Inter Variable", system-ui, sans-serif',
    h1: { fontFamily: editorialFont, fontSize: "clamp(2.22rem, 4.1vw, 3.65rem)", lineHeight: 1.08, fontWeight: 600, letterSpacing: "-.055em" },
    h2: { fontFamily: '"Inter Variable", system-ui, sans-serif', fontSize: "clamp(1.25rem, 3vw, 1.5rem)", lineHeight: 1.25, fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: "var(--background)", color: "var(--text-primary)" },
        ":focus-visible": { outline: "2px solid var(--secondary)", outlineOffset: 4 },
        ".sr-only": {
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clipPath: "inset(50%)",
          whiteSpace: "nowrap",
        },
      },
    },
    MuiLinearProgress: {
      defaultProps: { color: "secondary", variant: "determinate" },
      styleOverrides: {
        root: { height: 6, borderRadius: 999, backgroundColor: "var(--surface-muted)" },
        bar: { borderRadius: 999, transition: "none" },
      },
    },
  },
});

export function BalsaveThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
