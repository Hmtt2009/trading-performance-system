# [Product Name TBD]
## AI-Powered Trading Performance System

> Upload your trades. See what you're really doing.

An AI-powered system that analyzes U.S. stock trade data and automatically discovers behavioral patterns costing traders money — from nothing but a CSV file upload.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [BRD.md](docs/BRD.md) | Business Requirements Document — the product bible |
| [PHASE_PLAN.md](docs/PHASE_PLAN.md) | MVP → Phase 2 → Phase 3 scope |
| [TECHNICAL_SPEC.md](docs/TECHNICAL_SPEC.md) | Architecture, stack, data models, APIs |
| [PATTERNS_SPEC.md](docs/PATTERNS_SPEC.md) | Behavioral pattern detection algorithms |
| [DECISIONS_LOG.md](docs/DECISIONS_LOG.md) | All decisions tracked across development |
| [PROJECT_INSTRUCTIONS.md](docs/PROJECT_INSTRUCTIONS.md) | Claude Project system prompt |

## Current Phase: MVP

**Focus:** IBKR stock traders. Upload CSV → detect 4 behavioral patterns → AI coaching debrief.

See [PHASE_PLAN.md](docs/PHASE_PLAN.md) for full scope.

## Tech Stack

- **Frontend:** Next.js 14+ / TypeScript / Tailwind / shadcn/ui
- **Backend:** Next.js API Routes
- **Database:** Supabase (PostgreSQL)
- **AI:** Claude API (Anthropic)
- **Payments:** Stripe
- **Hosting:** Vercel

## Getting Started

```bash
# Clone
git clone [repo-url]
cd [repo-name]

# Install
npm install

# Environment
cp .env.example .env.local
# Fill in Supabase, Anthropic, Stripe keys

# Run
npm run dev
```

## Project Structure

```
├── docs/                    # Product & technical documentation
│   ├── BRD.md
│   ├── PHASE_PLAN.md
│   ├── TECHNICAL_SPEC.md
│   ├── PATTERNS_SPEC.md
│   ├── DECISIONS_LOG.md
│   └── PROJECT_INSTRUCTIONS.md
├── src/
│   ├── app/                 # Next.js app router pages
│   ├── components/          # React components
│   ├── lib/                 # Shared utilities
│   │   ├── parser/          # CSV parsing logic
│   │   ├── analysis/        # Analysis engine
│   │   │   ├── baseline.ts  # Trader baseline computation
│   │   │   ├── patterns/    # Pattern detection modules
│   │   │   ├── pnl.ts       # P&L calculations
│   │   │   └── scorecard.ts # Edge scorecard
│   │   ├── ai/              # AI layer (Claude API)
│   │   └── db/              # Database queries
│   ├── types/               # TypeScript type definitions
│   └── styles/              # Global styles
├── supabase/
│   └── migrations/          # Database migrations
└── tests/
    ├── parser/              # Parser tests
    ├── patterns/            # Pattern detection tests
    └── fixtures/            # Test CSV files
```

## License

Proprietary. All rights reserved.
