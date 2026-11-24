"use client";

import Button from "@mui/material/Button";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function HomeSignInLink() {
  if (usePathname() !== "/") return null;

  return (
    <Button
      component={Link}
      href="/acesso"
      variant="contained"
      disableElevation
      sx={{ minHeight: 44, px: 2.5, borderRadius: "var(--radius-button)", flexShrink: 0, fontWeight: 600, textTransform: "none" }}
    >
      Entrar
    </Button>
  );
}
