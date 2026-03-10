# DECISIONS LOG
## Track all decisions made across project chats

This file is the single source of truth for decisions made during development.
Claude must update this file after every significant conversation.

---

## How to Use This File

After each chat session that involves a decision:
1. Add an entry with date, decision, and context
2. If a decision contradicts a previous one, mark the old one as SUPERSEDED
3. Reference which document was updated if applicable

---

## Decisions

### PRE-BUILD PHASE

| # | Date | Decision | Context | Status |
|---|------|----------|---------|--------|
| 001 | 2026-03-10 | Product is a standalone SaaS (not part of Salla Analytics) | Founder decision | ACTIVE |
| 002 | 2026-03-10 | Target: U.S. stock traders only (options in Phase 2) | BRD v2, reviewer consensus | ACTIVE |
| 003 | 2026-03-10 | MVP: IBKR only (single broker, single format) | Reviewer recommendation, founder uses IBKR | ACTIVE |
| 004 | 2026-03-10 | Zero manual input required (optional feedback allowed) | Product principle, refined after review | ACTIVE |
| 005 | 2026-03-10 | 4 behavioral patterns in MVP (overtrading, tilt, revenge, premature exit) | Scope reduction from original 7 | ACTIVE |
| 006 | 2026-03-10 | Chart analysis deferred to Phase 2 | Both reviewers recommended | ACTIVE |
| 007 | 2026-03-10 | News context deferred to Phase 2 | Both reviewers recommended | ACTIVE |
| 008 | 2026-03-10 | AI is narrator/explainer only — not analyst | Technical architecture decision | ACTIVE |
| 009 | 2026-03-10 | Confidence levels (High/Medium) shown on all pattern detections | Reviewer feedback on scientific claims | ACTIVE |
| 010 | 2026-03-10 | Single paid tier in MVP (no premium tier) | Simplify pricing | ACTIVE |
| 011 | 2026-03-10 | Free anonymous upload with limited report (no account needed) | Acquisition strategy | ACTIVE |
| 012 | 2026-03-10 | Product name TBD | Not decided yet | PENDING |
| 013 | 2026-03-10 | Platform: Web app, responsive for mobile (no native app) | Founder decision | ACTIVE |
| 014 | 2026-03-10 | "Cost of Behavior" is the #1 hook — must be prominent | Reviewer suggestion, founder agreed | ACTIVE |
| 015 | 2026-03-10 | Project uses GitHub for version control and documentation | Founder decision | ACTIVE |
| 016 | 2026-03-11 | All code written via Claude Code (CLI agentic tool) | Founder decision — Claude Code excels at logic, weak at UI | ACTIVE |
| 017 | 2026-03-11 | UI/UX designed separately via external tools (TBD) | Claude Code is weak at visual design. Frontend components built design-ready but unstyled. | ACTIVE |
| 018 | 2026-03-11 | GitHub is the single source of truth for all code | Enables multi-tool access, PR review, version history | ACTIVE |

---

## Ideas Backlog (NOT in current phase)

| Idea | Source | Phase |
|------|--------|-------|
| Slack/Telegram daily debrief delivery | Reviewer 1 | Phase 3 |
| Discipline Score (gamification) | Reviewer 1 | Phase 2 |
| B2B: Prop firm behavioral scoring | Reviewer 1 | Phase 3 |
| Shareable free report for virality | Reviewer 1 | Phase 2 |
| "Compare best days vs worst days" | Reviewer 2 | MVP (included) |
| Session timeline view | Reviewer 2 | MVP (included) |
| "Do More / Do Less" summaries | Reviewer 2 | MVP (included) |
| Trust & Methodology panel | Reviewer 2 | MVP (included) |
| AI coaching conversations | Original BRD | Phase 3 |
| Pre-session mental check-in | Original BRD | Phase 3 |
| Trade replay | Original BRD | Phase 3 |

---

## Scope Change History

| Date | Change | Justification | Approved |
|------|--------|---------------|----------|
| 2026-03-10 | Reduced from 7 to 4 behavioral patterns | Reviewer consensus: focus on high-confidence | Yes |
| 2026-03-10 | Removed chart analysis from MVP | Technical risk too high for V1 | Yes |
| 2026-03-10 | Removed news context from MVP | Not core, adds complexity | Yes |
| 2026-03-10 | Options deferred to Phase 2 | Doubles parsing complexity | Yes |
| 2026-03-10 | Single broker (IBKR) for MVP | Focus on one format first | Yes |
| 2026-03-10 | Removed premium tier from MVP | One paid tier is simpler | Yes |