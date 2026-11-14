import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import { type Transaction, transactionCategory } from "../../lib/finance";
import { formatShortDate, formatSignedMoney } from "../../lib/format";
import { SectionCard } from "../cards/section-card";

const amountColors = {
  expense: "var(--negative)",
  income: "var(--positive)",
  refund: "var(--positive)",
  transfer: "var(--text-secondary)",
} satisfies Record<Transaction["kind"], string>;

export function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  return (
    <SectionCard id="lancamentos" title="Lançamentos recentes">
      <List disablePadding role="list">
        {transactions.map((transaction, index) => {
          const incoming = transaction.kind === "income" || transaction.kind === "refund";
          return (
            <ListItem
              key={transaction.id}
              disableGutters
              divider={index < transactions.length - 1}
              sx={{ flexWrap: "wrap", alignItems: "baseline", columnGap: 1.5, borderColor: "var(--border)" }}
            >
              <ListItemText
                sx={{ minWidth: "max-content", my: 0 }}
                primary={transaction.name}
                secondary={`${transactionCategory(transaction)} · ${formatShortDate(transaction.date)}`}
                slotProps={{
                  primary: { variant: "body2", sx: { fontWeight: 500 } },
                  secondary: { variant: "body2", color: "var(--text-secondary)" },
                }}
              />
              <Typography
                variant="body2"
                sx={{
                  color: amountColors[transaction.kind],
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  marginInlineStart: "auto",
                }}
              >
                {formatSignedMoney(incoming ? transaction.amountCents : -transaction.amountCents)}
              </Typography>
            </ListItem>
          );
        })}
      </List>
    </SectionCard>
  );
}
