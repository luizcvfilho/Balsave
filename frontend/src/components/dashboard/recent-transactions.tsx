import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { isIncoming, ledgerBalanceImpact, type Transaction, transactionCategory } from "../../lib/finance";
import { formatShortDate, formatSignedMoney } from "../../lib/format";
import { SectionCard } from "../cards/section-card";
import { balanceImpactColor } from "../details/transaction-table";

export function RecentTransactions({ transactions, getHref }: {
  transactions: Transaction[];
  getHref: (id?: string) => string;
}) {
  return (
    <SectionCard id="lancamentos" title="Lançamentos recentes" href={getHref()}>
      <List disablePadding role="list">
        {transactions.map((transaction, index) => {
          const incoming = isIncoming(transaction);
          const impact = ledgerBalanceImpact(transaction);
          return (
            <ListItem
              key={transaction.id}
              disableGutters
              divider={index < transactions.length - 1}
              sx={{ flexWrap: "wrap", alignItems: "baseline", columnGap: 1.5, borderColor: "var(--border)" }}
            >
              <ListItemText
                sx={{ minWidth: 0, my: 0 }}
                primary={<Link className="report-link report-action" href={getHref(transaction.id)}>{transaction.name}</Link>}
                secondary={`${transactionCategory(transaction)} · ${formatShortDate(transaction.date)}`}
                slotProps={{
                  primary: { variant: "body2", sx: { fontWeight: 500 } },
                  secondary: { variant: "body2", color: "var(--text-secondary)" },
                }}
              />
              <Typography
                variant="body2"
                sx={{
                  color: balanceImpactColor(impact),
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  marginInlineStart: "auto",
                }}
              >
                {formatSignedMoney(incoming ? transaction.amountCents : -transaction.amountCents)}
                {impact === 0 && <span className="sr-only">Movimentação interna ou sem efeito no saldo.</span>}
              </Typography>
            </ListItem>
          );
        })}
      </List>
    </SectionCard>
  );
}
