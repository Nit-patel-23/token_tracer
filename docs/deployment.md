# Deployment

## Recommended: Vercel + Neon

1. Create a Neon Postgres database
2. Import the GitHub repo into Vercel
3. Set environment variables (see [configuration.md](configuration.md)):
   - `DATABASE_URL`
   - `SESSION_SECRET`
   - `ADMIN_PASSWORD`
   - `SUPERADMIN_PASSWORD`
   - `NEXT_PUBLIC_SERVER_URL` → your production URL
4. Deploy
5. Sign in as `superadmin` and run **Database migration**
6. Create teams/users and distribute daemon install commands

## Docker (community pattern)

A first-party Dockerfile is on the roadmap. Until then:

```bash
npm run build
npm run start
```

Run behind a reverse proxy with HTTPS. Ensure `NODE_ENV=production` and a strong `SESSION_SECRET`.

## Checklist

- [ ] `SESSION_SECRET` set (unique, ≥32 bytes entropy)
- [ ] `NEXT_PUBLIC_SERVER_URL` points at the public HTTPS origin
- [ ] Migration applied
- [ ] Superadmin password rotated after first login
- [ ] `ALLOW_LEGACY_ADMIN_TOKEN` left unset
- [ ] Database credentials are least-privilege
- [ ] Backups enabled on Postgres
