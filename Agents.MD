
# Valora - Development Instructions

## Project Overview

Valora is a private, responsive web application for personal finance.
It runs in desktop browsers and Safari on iPhone. On iPhone, users can
also install it as a PWA from Safari.

Tagline: "Controle, patrimônio e evolução."

The application consolidates financial information
to provide a unified view of expenses, income,
investments, assets, and financial goals.

## Technology Stack

Preferred technologies:

- Next.js with App Router
- TypeScript
- React
- Tailwind CSS
- Docker Compose
- PostgreSQL for persistent storage
- Responsive web interface with optional PWA installation on iPhone
- Pluggy API for Open Finance integration

Use current stable compatible versions.

Keep dependencies minimal.

## Security Requirements

Financial data is highly sensitive.

- Never expose API secrets in frontend code.
- Keep Pluggy credentials exclusively server-side.
- Never commit secrets or .env files.
- Do not log tokens or sensitive financial data.
- Authenticate every private API endpoint.
- Authorize access to all user-owned resources.
- Use secure session cookies.
- Validate all external inputs.
- Apply least-privilege database permissions.
- Do not persist unnecessary financial data.
- Implement encrypted backups where appropriate.

Do not assume that a private network alone
provides complete application security.

## Open Finance

Use the official Pluggy API documentation.

Develop the integration in a separate
server-side module.

Initially use mocked financial data.

Real Pluggy credentials should only be
configured after the application and
authentication are ready.

Support graceful API failures and
data synchronization errors.

Do not invent Pluggy endpoints or fields.

## Brand Identity

Brand name: Valora

Tagline:
"Controle, patrimônio e evolução."

Visual direction:
Terra Premium.

Brand attributes:
- Minimalist
- Premium
- Trustworthy
- Calm
- Elegant
- Modern
- Clear

The logo is a geometric V integrated with a coin-inspired circular shape. [Valora SVG](assets/valora.svg)

Use a subtle terracotta accent.

## Theme Tokens

Use the CSS tokens for the light and dark palettes, border radii, and spacing. The stylesheet also provides base styles for the page and financial cards. [Valora theme CSS](assets/valora-theme.css)

## Typography

- Playfair Display for editorial headings
- Inter for interface elements, financial data,
  buttons, tables and navigation

Use tabular numerals for monetary values.

## UI Guidelines

- Make all core workflows available in desktop browsers and on iPhone.
- Use wider layouts on desktop for dashboards, charts, tables, and filters.
- Adapt navigation, forms, charts, and tables to small screens and touch on iPhone.
- Support keyboard navigation and visible focus on desktop, and use comfortable touch targets on iPhone.
- Minimal visual clutter
- Clear visual hierarchy
- Accessible contrast
- Reduced motion support
- Consistent Light and Dark themes

The dashboard should prioritize:
1. Net worth
2. Income and expenses
3. Spending categories
4. Investment overview
5. Financial goals

## Engineering Guidelines

- Prefer simple, maintainable solutions.
- Use reusable components.
- Separate business logic from UI components.
- Use TypeScript strict mode.
- Add tests for important financial calculations.
- Use Brazilian locale (pt-BR).
- Format currency as BRL.
- Store monetary values using exact decimal
  representations, not floating-point arithmetic.
- Store timestamps consistently and apply
  the correct timezone for display.
- Document architectural decisions.
- Avoid unnecessary abstractions.

## Development Approach

Implement the application incrementally.

Before implementing major changes:
- Explain the proposed approach.
- Identify affected files.
- Preserve the established brand identity.

Do not add unrelated features without approval.
