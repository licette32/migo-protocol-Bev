# Contributing to Migo Protocol

Thanks for your interest in contributing to Migo — open source split payment infrastructure built on Stellar.

Migo is a **N:1 payment orchestration layer**: multiple people pay in different currencies and wallets, one merchant receives in their configured asset. Every contribution helps make group payments in Latin America faster, fairer, and more accessible.

---

## Before you start

1. Read the [README](./README.md) to understand how Migo works
2. Browse the [open issues](https://github.com/migo-labs/migo-protocol/issues) — look for `good first issue` if you're new
3. Comment on the issue you want to work on before starting — this avoids duplicate work

---

## How to contribute

### 1. Fork and clone
```bash
git clone https://github.com/YOUR_USERNAME/migo-protocol.git
cd migo-protocol
```

### 2. Set up the project
```bash
# Backend
cd api
cp .env.example .env   # add your Stellar testnet keys
npm install
npm run dev            # runs on http://localhost:3001

# Frontend (new terminal)
cd frontend
npm install
npm run dev            # runs on http://localhost:3000
```

### 3. Create a branch
```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/your-bug-name
```

### 4. Make your changes

- Keep changes focused — one issue per PR
- Follow the existing code style (TypeScript, Express, Next.js)
- Add comments for non-obvious logic
- Test your changes manually against the Stellar testnet

### 5. Open a Pull Request

- Reference the issue number in your PR description: `Closes #12`
- Describe what you changed and why
- Include a short test plan: how did you verify it works?

---

## Project structure

```
migo-protocol/
├── api/                    # Express + TypeScript backend
│   └── src/
│       ├── controllers/    # HTTP layer
│       ├── services/       # Business logic
│       ├── types/          # TypeScript types
│       └── routes/         # Route definitions
│
└── frontend/               # Next.js 15 frontend
    ├── app/
    │   ├── pos/            # Merchant screen — generates QR
    │   └── pay/[id]/       # Payer screen — pays their share
    └── lib/
        ├── wallets.ts      # Stellar wallet integrations
        └── payment-providers/  # Fiat payment providers
```

---

## Key concepts

- **Split**: a payment request for a total amount, shared by N people
- **Settlement asset**: the currency the merchant always receives (e.g. USDC)
- **Payment method**: how each individual pays (XLM, USDC, ARS, MercadoPago, card...)
- **Conversion**: Migo converts each payment to the settlement asset before settling
- **Settlement**: once `totalPaid >= totalAmount`, an on-chain Stellar transaction sends funds to the merchant automatically

---

## Issue labels

| Label | Meaning |
|-------|---------|
| `good first issue` | Small, well-scoped, great for newcomers |
| `backend` | Changes to `api/` |
| `frontend` | Changes to `frontend/` |
| `stellar` | Involves Stellar SDK, SEP standards, or on-chain logic |
| `payments` | New payment provider integration |
| `latam` | Latin America-specific features |
| `security` | Security improvements |
| `internal` | Being resolved by the core team — not available for contributors |

---

## Questions?

Open a [GitHub Discussion](https://github.com/migo-labs/migo-protocol/discussions) or reach out on X: [@migopayments](https://x.com/migopayments)

Built with ☀️ in Latin America at ImpactaBootcamp 2026.