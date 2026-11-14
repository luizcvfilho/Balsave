import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

export type BreakdownRow = {
  key: string;
  label: ReactNode;
  value: ReactNode;
};

export function BreakdownList({ rows }: { rows: BreakdownRow[] }) {
  return (
    <Box component="dl" sx={{ m: 0, mt: 1 }}>
      {rows.map(({ key, label, value }) => (
        <Box
          key={key}
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "2px 12px",
            py: 1,
            "&:not(:last-child)": { borderBottom: "1px solid var(--border)" },
            "&:last-child": { pb: 0 },
          }}
        >
          <Typography component="dt" variant="body2" color="var(--text-secondary)">{label}</Typography>
          <Typography component="dd" variant="body2" sx={{ m: 0, marginInlineStart: "auto", textAlign: "end", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
