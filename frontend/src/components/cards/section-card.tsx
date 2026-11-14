import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

type Props = {
  id: string;
  title: string;
  description?: string;
  action?: ReactNode;
  highlighted?: boolean;
  children: ReactNode;
};

export function SectionCard({ id, title, description, action, highlighted = false, children }: Props) {
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
        {action}
      </Stack>
      {children}
    </Card>
  );
}
