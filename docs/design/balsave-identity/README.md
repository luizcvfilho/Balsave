# Balsave visual identity proposal

Open `index.html` in a browser. The prototype uses sample data and bundled fonts. It has no network or build dependencies. The top-right control switches themes. The “Identidade visual” screen contains the color palette, logo downloads, navigation map, and product references.

## Navigation

The desktop header and iPhone bottom bar share the same four sections. The profile menu in the header holds account access. Contextual links reuse the current report's filters and the device's browser history where applicable.

| Main section | Section links | Existing application routes |
| --- | --- | --- |
| “Visão geral” or “Início” on iPhone | Dashboard shortcuts to the statement, spending reports, and accounts | `/` |
| “Extrato” | “Lançamentos”, transaction details, and “A receber” | `/lancamentos`, `/a-receber` |
| “Gastos” | “Por categoria”, “Ritmo de gastos”, and “Categorias e regras” | `/gastos`, `/categorias` |
| “Contas” | “Contas”, “Evolução”, “Conciliação”, “Cartões”, and “Conexões” | `/contas`, `/cartoes`, `/conexoes` |
| Profile menu | “Minha conta” | `/acesso` |

In “Extrato”, bank and card filters combine with the period, search, and movement type. Selecting a bank scopes the card list to that institution and clears a previously selected card when it belongs to a different bank. Selecting a card narrows the results to transactions made with that card.

## Identity

White and graphite provide the page backgrounds. Green marks the active section, the balance chart, and the thin edge of the transaction table. Playfair Display stays on page headings, with Inter and tabular numerals for controls and financial data.

Categories use a filled chip with an icon. Tags use rounded outlined chips. In the application, custom categories and tags should use their stable IDs to keep colors consistent when renamed. Assign colors from a palette verified for both themes and wrap each chip onto a new line as space gets tighter. On desktop, classifications have a dedicated column. On small screens, they sit below the transaction dates.

The bank badges are illustrative monograms. The connector metadata documents an `imageUrl` for institution artwork. A generic bank icon and the institution's name can serve as the fallback. [Pluggy connector reference](https://v2.docs.pluggy.ai/en/reference/connector/connector-retrieve)

The SVG letterforms and symbol are vector paths. The same symbol is used as the prototype favicon.
