# Vitrin Store — Project Status (17 Nov 2026)

## Current implementation
This is a Persian RTL e-commerce demonstration built with HTML, CSS, browser JavaScript, Node.js/Express and PostgreSQL.

### Frontend
- Responsive homepage, search, category filters and local SVG product illustrations.
- Product detail modal with product description, specifications, price, stock, rating average and reviews.
- Customer registration/login UI.
- Cart persisted in browser localStorage.
- Checkout form and order history.
- Review form with optional customer photo upload.
- Bottom navigation for home, cart, orders, management and settings.
- Contact, buying guide and shipping/returns information pages.

### Backend
- PostgreSQL schema is initialized automatically on startup.
- Seed catalog of eight clearly illustrative/sample products.
- Password hashing with bcryptjs and signed JWT authentication.
- Customer and admin roles.
- Product listing/details, reviews, image data, orders and order items.
- Stock checks and transactional order creation.
- Review marked as verified purchase only after a matching order is marked delivered.
- Admin product create/update/hide and order status management.
- Helmet security headers, API rate limits and basic input validation.

## Local execution
Node.js 20+, PostgreSQL and environment variables are required. Copy `backend/.env.example` to `backend/.env`, configure the database and secrets, then run `cd backend`, `npm install`, `npm run dev`. Open `http://localhost:4000`.

Do not use Live Server for this integrated version: Express serves both the frontend and API.

## Render deployment
`render.yaml` defines the web service. `DEPLOY-RENDER.md` explains GitHub, PostgreSQL, environment variables, health checks and free-tier limitations. Actual deployment still requires the owner's GitHub and Render account actions and secret values.

## Explicit limitations
- No real payment gateway; checkout currently supports cash on delivery only.
- Product information and product artwork are samples, not client-approved catalog data.
- Contact details, shipping/returns policy and legal pages must be completed by the store owner.
- No password reset, email/SMS notifications or external object storage/CDN.
- A real commercial launch requires legal, privacy, payment, security and operational review.
