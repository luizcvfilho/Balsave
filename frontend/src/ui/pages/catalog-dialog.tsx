"use client";

import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import type { ReactNode } from "react";

export function CatalogDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <Dialog open fullWidth maxWidth="sm" onClose={onClose} aria-labelledby="catalog-dialog-title"
    slotProps={{ paper: { sx: { bgcolor: "var(--surface)", color: "var(--text-primary)", borderRadius: "var(--radius-card)", m: { xs: 2, sm: 4 } } } }}>
    <DialogTitle id="catalog-dialog-title">{title}</DialogTitle>
    <DialogContent dividers>{children}</DialogContent>
  </Dialog>;
}
