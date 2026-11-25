import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  id: string;
  title: string;
  description?: string;
  action?: ReactNode;
  href?: string;
  linkLabel?: string;
  className?: string;
  linkSurface?: boolean;
  highlighted?: boolean;
  flushContent?: boolean;
  children: ReactNode;
};

export function SectionCard({ id, title, description, action, href, linkLabel, className, linkSurface, highlighted = false, flushContent = false, children }: Props) {
  const titleId = `${id}-title`;

  return (
    <Card
      component="section"
      id={id}
      className={className}
      aria-labelledby={titleId}
      variant="outlined"
      sx={{
        minWidth: 0,
        p: flushContent ? 0 : "var(--panel-padding)",
        color: "var(--text-primary)",
        bgcolor: highlighted ? "var(--surface)" : "var(--background)",
        borderColor: "var(--border)",
        borderRadius: "var(--radius-card)",
        backgroundImage: "none",
        ...(href && linkSurface && {
          position: "relative",
          "& .card-detail-link::after": { content: '""', position: "absolute", inset: 0 },
          "& a:not(.card-detail-link)": { position: "relative" },
        }),
      }}
    >
      <Stack
        direction="row"
        useFlexGap
        spacing={1}
        className="financial-panel-heading"
        sx={{
          mb: flushContent ? 0 : 1,
          p: flushContent ? "var(--panel-padding)" : undefined,
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div>
          <Typography id={titleId} variant="h2" color="primary.main"
            sx={{ fontSize: "1.0625rem", fontWeight: 660, letterSpacing: "-.025em" }}>{title}</Typography>
          {description && (
            <Typography variant="body2" color="var(--text-secondary)" sx={{ mt: 0.5, fontSize: ".8125rem" }}>{description}</Typography>
          )}
        </div>
        {(action || href) && (
          <Stack direction="row" useFlexGap spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            {action}
            {href && (
              <Link className="card-detail-link report-link financial-panel-link" aria-label={linkLabel ?? `Ver detalhes de ${title}`} href={href}>
                {linkLabel ?? "Ver detalhes"} <span aria-hidden="true">→</span>
              </Link>
            )}
          </Stack>
        )}
      </Stack>
      {children}
    </Card>
  );
}
