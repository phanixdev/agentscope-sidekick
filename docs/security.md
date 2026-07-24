# Authentication and Tenant Isolation

AgentScope Sidekick uses Supabase Auth for identity and PostgreSQL row-level security for authorization. These controls provide the tenant-isolation boundary for authenticated workspaces. The browser receives only the publishable key. No service-role credential is bundled into the web application.

## Enforced Boundaries

| Resource | Read boundary | Write boundary |
| --- | --- | --- |
| Workspaces and memberships | Current workspace members | Provisioning functions only |
| Agent runs, spans, and logs | Current workspace members | Scoped authenticated RPCs |
| Alert rules | Current workspace members | Workspace owners and admins |
| Investigation notes | Note author plus current membership | Note author plus current membership |
| Remediations | Current workspace members | Authenticated member who initiated it |

All product tables enable RLS. `create_demo_run`, `get_healthy_baselines`, and `run_remediation` explicitly revoke execution from `PUBLIC` and `anon`, then grant only `authenticated`.

## Test Coverage

Run the database policy suite against a local Supabase stack:

```bash
npx supabase start
npx supabase db reset
npx supabase test db supabase/tests/rls_isolation.sql
```

The pgTAP suite verifies policy inventories, anonymous RPC denial, authenticated RPC grants, and the membership requirement on note updates. Application contract tests additionally fail when a product table is introduced without an RLS declaration.

## Session Behavior

Supabase sessions persist in the browser, refresh automatically, and are revalidated on startup. Unauthenticated users see the sign-in screen or may enter the explicitly labeled, deterministic judge workspace. Signing out removes the authenticated product session.