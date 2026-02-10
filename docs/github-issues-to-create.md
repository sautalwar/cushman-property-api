# Pre-Staged GitHub Issues

Create these issues on the GitHub repo BEFORE the demo call. They serve as demo material for the Copilot Coding Agent segment.

---

## Issue 1: For Copilot Coding Agent Demo (assigned to Copilot)

**Title:** Add input validation to all API endpoints

**Labels:** `enhancement`, `security`

**Body:**

```
## Description

Our API endpoints currently accept raw request bodies without validation. We need to add comprehensive input validation to prevent invalid data from reaching the database.

## Requirements

- Add input validation to `POST /api/properties` — validate all required fields, types, and ranges
- Add input validation to `POST /api/tenants` — validate email format, date ranges, monetary values
- Add input validation to `POST /api/auth/register` — validate email format, password strength
- Add input validation to `PATCH /api/properties/:id/occupancy` — validate rate is 0-100
- Return clear 400 error messages with field-specific details

## Acceptance Criteria

- [ ] All POST/PATCH endpoints validate input before processing
- [ ] Invalid requests return 400 with descriptive error messages
- [ ] Unit tests cover validation logic
- [ ] No breaking changes to existing valid requests
```

---

## Issue 2: For Agent Mode Demo (you do this live)

**Title:** Add rate limiting to API endpoints

**Labels:** `enhancement`, `security`

**Body:**

```
## Description

Add rate limiting to protect the API from abuse. Implement per-IP rate limiting for public endpoints and per-user rate limiting for authenticated endpoints.

## Requirements

- Install and configure express-rate-limit
- 100 requests per 15 minutes for auth endpoints
- 500 requests per 15 minutes for authenticated endpoints
- Return 429 Too Many Requests with retry-after header

## Acceptance Criteria

- [ ] Rate limiting middleware is applied to all routes
- [ ] Different limits for public vs. authenticated endpoints
- [ ] Proper 429 responses with retry information
```

---

## Issue 3: Backlog (shows realistic project context)

**Title:** Add property search by geolocation

**Labels:** `enhancement`, `backlog`

**Body:**

```
## Description

Allow users to search properties within a radius of given coordinates. This will support the mobile app's "properties near me" feature.

## Requirements

- Accept latitude, longitude, and radius (miles) as query parameters
- Use PostGIS extension for spatial queries
- Return results sorted by distance

## Acceptance Criteria

- [ ] GET /api/properties/nearby?lat=X&lng=Y&radius=Z endpoint works
- [ ] Results include distance from search point
- [ ] Proper error handling for invalid coordinates
```
