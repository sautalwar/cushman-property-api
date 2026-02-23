# Cushman Property API

Commercial real estate property management REST API built with TypeScript, Express, and PostgreSQL.

## Features

- **Property Management** — CRUD operations for commercial properties
- **Tenant Management** — Lease tracking, expiring lease alerts
- **Authentication** — JWT-based auth with role-based access (admin, manager, viewer)
- **Portfolio Analytics** — Summary dashboard for property portfolios

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run database migrations
psql -f db/init.sql

# Start development server
npm run dev

# Run tests
npm test
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Authenticate user |
| POST | /api/auth/register | Register new user |
| GET | /api/properties | List all properties |
| GET | /api/properties/search?q=term | Search properties |
| GET | /api/properties/:id | Get property details |
| POST | /api/properties | Create property |
| PATCH | /api/properties/:id/occupancy | Update occupancy |
| DELETE | /api/properties/:id | Delete property |
| GET | /api/tenants/property/:id | List tenants |
| POST | /api/tenants | Create tenant |
| GET | /api/tenants/expiring | Expiring leases |
| GET | /health | Health check |

## Tech Stack

- **Runtime:** Node.js 20 + TypeScript 5
- **Framework:** Express 4
- **Database:** PostgreSQL 15
- **Auth:** JWT + bcrypt
- **Testing:** Jest + ts-jest
- **CI/CD:** GitHub Actions + CodeQL
