# KASHIE — The Time Is Now

Full-stack V1 platform foundation for the KASHIE fine-art ecosystem.

## What is included
- Public KASHIE website with the visual feel of the earlier prototype.
- Artist registration/login and professional profiles.
- Artwork registration, verification workflow, IDs, status, QR-ready records.
- Public artist and artwork discovery.
- Buyer/collector accounts and artwork order records.
- Managed commission intake and project workflow.
- Exhibitions + competition entry system.
- Admin authentication and administration dashboard/API.
- Artist verification, artwork approval, commission/order management.
- Certificates, disputes, audit log data structures.
- PWA manifest/service worker for later app packaging.

## Important production security
The admin password is intentionally NOT hardcoded into the browser or repository. Set ADMIN_EMAIL and ADMIN_PASSWORD as private server environment variables. For production, use HTTPS, a persistent database, external session store, backups, real payment gateway, transactional email, Nigerian data-protection compliance, and professional legal documents.

## Run locally
1. Install Node.js 18+.
2. Copy `.env.example` to `.env` and set private values.
3. Start with `npm start` (environment variables must be loaded by your host; this project intentionally has no dotenv dependency).
4. Open http://localhost:3000.

For a quick local test on a shell, set variables before starting, e.g.:
ADMIN_EMAIL=admin@kashie.ng ADMIN_PASSWORD='your-private-password' SESSION_SECRET='long-random-secret' node server.js

## Deployment
Deploy as a Node web service, not static hosting, because the new version includes a server/API and authentication. The public site and future Android/iOS app should use this same backend.
