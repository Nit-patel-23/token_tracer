# Examples

## Daemon install (member machine)

After creating a member API key in Team → Manage Members:

```bash
export SERVER_URL="https://your-tracer.example.com"
export MEMBER_KEY="av_live_..."

curl -fsSL "$SERVER_URL/install.sh" | bash -s -- --key "$MEMBER_KEY"
```

## Filter team stats via API

```bash
curl -sS "$SERVER_URL/api/v1/team/stats?teamId=TEAM_UUID&from=2026-01-01&to=2026-01-31" \
  -H "Cookie: app_session=YOUR_SESSION_COOKIE" | jq '.totals'
```

More API details: [../api.md](../api.md)
