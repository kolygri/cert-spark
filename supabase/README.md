# Supabase foundation

Apply the migration after creating the Supabase project:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

The first migration creates a tenant-aware model for electrical contractors:

- organisations and role-based membership;
- clients, certificates and circuit schedules;
- accountable signing records and generated document references;
- immutable-style audit events for application actions;
- private certificate-document storage with organisation-scoped access.

The browser must never receive the Supabase service-role key. Issuing, signing, PDF generation and email delivery should execute through trusted server-side routes.
