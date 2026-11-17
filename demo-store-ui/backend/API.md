# API Reference

Base path: `/api`

## Public

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | API and database health |
| GET | `/products` | Active products; optional `q` and `category` query parameters |
| GET | `/products/:id` | Product details and average rating |
| GET | `/products/:id/reviews` | Product reviews and customer-uploaded photos |
| POST | `/auth/register` | Create a customer account |
| POST | `/auth/login` | Sign in and receive a JWT |

## Customer (Bearer token required)

| Method | Path | Purpose |
|---|---|---|
| GET | `/auth/me` | Current account profile |
| POST | `/products/:id/reviews` | Submit one review per product, rating and optional image |
| POST | `/orders` | Create a cash-on-delivery order and reserve stock transactionally |
| GET | `/orders/my` | List the signed-in customer's orders |

## Admin (Bearer token + admin role required)

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/summary` | Dashboard counters |
| POST | `/admin/products` | Create product |
| PUT | `/admin/products/:id` | Update product |
| DELETE | `/admin/products/:id` | Hide product from public catalog (soft delete) |
| GET | `/admin/orders` | List recent orders |
| PATCH | `/admin/orders/:id/status` | Change order status |

Authentication uses `Authorization: Bearer <token>`. Tokens expire after seven days. Passwords are stored as bcrypt hashes. Review images are accepted as JPEG, PNG or WebP data URLs up to 700 KB and stored in PostgreSQL.
