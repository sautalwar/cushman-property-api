# Copilot Custom Instructions — Cushman Property API

## Project Context
This is a TypeScript/Express REST API for managing commercial real estate properties. 
It serves as the backend for Cushman & Wakefield's property management portal.

## Coding Standards
- Use TypeScript strict mode for all new code.
- Follow the existing Express router pattern using `Router()`.
- Use parameterized SQL queries exclusively — never concatenate user input into SQL strings.
- All database queries go through the `src/config/database.ts` pool.
- Services handle business logic; routes handle HTTP concerns only.
- Use async/await — no callbacks or raw promises.
- Error responses follow the `{ error: string }` format.
- All endpoints require JWT authentication except `/api/auth/*` and `/health`.

## Security Requirements
- Never log sensitive data (passwords, tokens, keys).
- All new endpoints must use the `authMiddleware`.
- Input validation is required on all POST/PATCH endpoints.
- Use `bcryptjs` for password hashing with a minimum cost factor of 12.

## Testing
- Write unit tests using Jest with `ts-jest`.
- Mock the database layer using `jest.mock('../config/database')`.
- Test both success and error paths.
