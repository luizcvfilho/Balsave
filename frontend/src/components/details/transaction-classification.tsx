import type { ReactNode } from "react";
import { type DefaultCategoryKey, defaultCategories } from "../../lib/finance";
import styles from "./transaction-classification.module.css";

const chipColors = ["gold", "blue", "pink", "teal", "green", "purple", "copper"] as const;
type CategoryVisual = { icon: ReactNode; color?: typeof chipColors[number] };

const defaultCategoryVisuals = {
  food: { color: "gold", icon: <><path d="M3 4h2l2.5 10h10.8l2-7H6.1" /><circle cx="9" cy="19" r="1.2" /><circle cx="17" cy="19" r="1.2" /></> },
  housing: { color: "blue", icon: <path d="M3 10.5 12 3l9 7.5V21H3zM9 21v-7h6v7" /> },
  transport: { color: "teal", icon: <path d="m5 10 1.6-5h10.8l1.6 5M4 16h16v-5l-2-1H6l-2 1zm2 0v3m12-3v3M7 13h1m8 0h1" /> },
  health: { color: "pink", icon: <path d="M8 5h8v4h4v6h-4v4H8v-4H4V9h4z" /> },
  leisure: { color: "purple", icon: <path d="M4 4h16l-8 9-8-9Zm8 9v7m-4 0h8M7 7h10" /> },
  travel: { icon: <path d="M12 3a2 2 0 0 1 2 2v5l7 4v2l-7-2v3l2 2v2l-4-1-4 1v-2l2-2v-3l-7 2v-2l7-4V5a2 2 0 0 1 2-2Z" /> },
  shopping: { color: "copper", icon: <path d="M5 8h14l1 12H4L5 8Zm4 1V7a3 3 0 0 1 6 0v2" /> },
  education: { icon: <path d="M12 6C9 4 6 4 3 5v13c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v13M6 9h3m6 0h3" /> },
  services: { icon: <path d="M20 4a5 5 0 0 1-6.5 6.5l-8 9a2 2 0 0 1-3-2.7l9-8A5 5 0 0 1 18 2.5l-3 3 .5 3 3 .5Z" transform="translate(1 1)" /> },
  subscriptions: { icon: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="m10 8 5 2.5L10 13Zm-3 12h10m-5-3v3" /></> },
  insurance: { icon: <path d="M12 3c2.5 2 5 3 8 3v6c0 4-3 7-8 9-5-2-8-5-8-9V6c3 0 5.5-1 8-3Zm-3 9 2 2 4-4" /> },
  taxes: { icon: <><path d="M6 3h8l4 4v14H6zM14 3v5h4m-9 8 6-6" /><circle cx="9.5" cy="11" r="1" /><circle cx="14.5" cy="15.5" r="1" /></> },
  fees: { icon: <path d="m3 8 9-5 9 5v2H3zm1 12h16M6 10v7m6-7v7m6-7v7" /> },
  donations: { icon: <path d="M12 20 4.6 13a4.7 4.7 0 0 1 6.6-6.7l.8.8.8-.8a4.7 4.7 0 1 1 6.6 6.7Z" /> },
  gambling: { icon: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 8h.01m8 0h.01m-4 4h.01m-4 4h.01m8 0h.01" strokeWidth="2.5" /></> },
  loans: { icon: <><circle cx="15" cy="7" r="4" /><path d="M15 5.5v3M3 15h4l2-2h5a1.5 1.5 0 0 1 0 3h-3m4 0 4-2a1.5 1.5 0 0 1 1.6 2.5L14 21H7l-4-2" /></> },
  legal: { icon: <path d="M12 3v17M7 21h10M4 7h16M5.5 7 2 14h7L5.5 7Zm13 0L15 14h7l-3.5-7ZM2 14a3.5 3.5 0 0 0 7 0m6 0a3.5 3.5 0 0 0 7 0" /> },
  transfers: { icon: <path d="M3 8h17l-4-4m4 4-4 4m5 4H4l4-4m-4 4 4 4" /> },
  income: { icon: <path d="M20 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v12H5a2 2 0 0 1-2-2V6m17 6h-5a2 2 0 0 0 0 4h5" /> },
  investments: { icon: <path d="M4 4v16h16M7 15l4-4 3 2 6-7m-5 0h5v5" /> },
  pets: { icon: <><path d="M12 12c-2.4 0-2.9 2.3-4.5 3.6-2.2 1.7-.9 4.4 1.3 4.4 1.3 0 2-1 3.2-1s1.9 1 3.2 1c2.2 0 3.5-2.7 1.3-4.4C14.9 14.3 14.4 12 12 12Z" /><ellipse cx="4.5" cy="10.5" rx="1.5" ry="2" /><ellipse cx="9" cy="6.5" rx="1.5" ry="2" /><ellipse cx="15" cy="6.5" rx="1.5" ry="2" /><ellipse cx="19.5" cy="10.5" rx="1.5" ry="2" /></> },
  review: { icon: <path d="M12 4 2.8 20h18.4L12 4Zm0 6v4m0 3h.01" /> },
  uncategorized: { icon: <><circle cx="12" cy="12" r="8" strokeDasharray="2 3" /><path d="M9 12h6" /></> },
} satisfies Record<DefaultCategoryKey, CategoryVisual>;

const categoryVisuals = new Map<string, CategoryVisual>([
  ...Object.entries(defaultCategoryVisuals),
  ...defaultCategories.map(([code, label]) => [`legacy:${label}`, defaultCategoryVisuals[code]] as const),
  ["kind:income", { ...defaultCategoryVisuals.income, color: "green" }],
  ["kind:refund", { icon: <path d="M9 4 4 9l5 5M4 9h10a5 5 0 0 1 0 10h-3" /> }],
  ["kind:credit", { icon: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18m-7 5h4m-2-2v4" /></> }],
  ["kind:transfer", defaultCategoryVisuals.transfers],
  ["kind:internal-transfer", { icon: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><path d="M13 6h4v4m-6 8H7v-4m8-6 2 2 2-2m-10 8-2-2-2 2" /></> }],
]);

function chipColor(id: string) {
  let hash = 0;
  for (const character of id) {
    hash = (Math.imul(31, hash) + (character.codePointAt(0) ?? 0)) >>> 0;
  }
  return chipColors[hash % chipColors.length];
}

export function CategoryIcon({ categoryKey }: { categoryKey: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      {categoryVisuals.get(categoryKey)?.icon ?? <path d="M4 4h8l8 8-8 8-8-8zm4 4h.01" />}
    </svg>
  );
}

export function CategoryChip({ categoryKey, categoryId, label }: {
  categoryKey: string;
  categoryId?: string | null;
  label: string;
}) {
  const color = categoryVisuals.get(categoryKey)?.color
    ?? (categoryKey === "uncategorized" || categoryKey === "review" ? undefined : chipColor(categoryId ?? categoryKey));
  return (
    <span className={`${styles.chip} ${styles.category}`} data-color={color}>
      <CategoryIcon categoryKey={categoryKey} />
      <span>{label}</span>
    </span>
  );
}

export function TagChip({ id, label }: { id: string; label: string }) {
  return <span className={`${styles.chip} ${styles.tag}`} data-color={chipColor(id)}>{label}</span>;
}
