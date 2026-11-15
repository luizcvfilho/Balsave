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
  linkSurface?: boolean;
  highlighted?: boolean;
  children: ReactNode;
};

export function SectionCard({ id, title, description, action, href, linkSurface, highlighted = false, children }: Props) {
  const titleId = `${id}-title`;

  return (
    <Card
      component="section"
      id={id}
      aria-labelledby={titleId}
      variant="outlined"
      sx={{
        minWidth: 0,
        p: { xs: 2, sm: 2.5 },
        color: "var(--text-primary)",
        bgcolor: highlighted ? "var(--surface-muted)" : "var(--surface)",
        borderColor: "var(--border)",
        borderTop: highlighted ? "3px solid var(--accent)" : undefined,
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
        sx={{ mb: 1, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}
      >
        <div>
          <Typography id={titleId} variant="h2" color="primary.main">{title}</Typography>
          {description && (
            <Typography variant="body2" color="var(--text-secondary)" sx={{ mt: 0.5 }}>{description}</Typography>
          )}
        </div>
        {(action || href) && (
          <Stack direction="row" useFlexGap spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            {action}
            {href && <Link className="card-detail-link report-link report-action" aria-label={`Ver detalhes de ${title}`} href={href}>Ver detalhes</Link>}
          </Stack>
        )}
      </Stack>
      {children}
    </Card>
  );
}
