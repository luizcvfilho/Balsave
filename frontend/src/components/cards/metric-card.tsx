import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { BreakdownList, type BreakdownRow } from "./breakdown-list";
import { SectionCard } from "./section-card";

type Props = {
  id: string;
  title: string;
  value: string;
  detail?: string;
  indicator?: ReactNode;
  rows: BreakdownRow[];
  highlighted?: boolean;
  href?: string;
};

export function MetricCard({ id, title, value, detail, indicator, rows, highlighted, href }: Props) {
  return (
    <SectionCard id={id} title={title} highlighted={highlighted} href={href} linkSurface>
      <Stack direction="row" useFlexGap spacing={0.75} sx={{ alignItems: "baseline", flexWrap: "wrap" }}>
        <Typography
          color="primary.main"
          sx={{ fontSize: "clamp(1.6rem, 5vw, 2.25rem)", fontWeight: 600, lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}
        >
          {value}
        </Typography>
        {detail && (
          <Typography variant="body2" color="var(--text-secondary)" sx={{ fontVariantNumeric: "tabular-nums" }}>{detail}</Typography>
        )}
      </Stack>
      {indicator && <Box sx={{ mt: 1 }}>{indicator}</Box>}
      <BreakdownList rows={rows} />
    </SectionCard>
  );
}
