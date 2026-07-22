create extension if not exists "pgcrypto";

create type public.member_role as enum ('owner', 'admin', 'engineer', 'viewer');
create type public.certificate_status as enum ('draft', 'review_required', 'ready_to_sign', 'signed', 'issued', 'void');
create type public.signatory_role as enum ('design', 'construction', 'inspection_testing');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'engineer',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  certificate_number text not null,
  title text not null,
  status public.certificate_status not null default 'draft',
  standard_version text not null default 'BS 7671:2018+A4:2026',
  installation_address jsonb not null default '{}'::jsonb,
  certificate_data jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  issued_at timestamptz,
  unique (organization_id, certificate_number)
);

create table public.certificate_circuits (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  circuit_number integer not null,
  circuit_data jsonb not null default '{}'::jsonb,
  test_results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (certificate_id, circuit_number)
);

create table public.certificate_signatures (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  role public.signatory_role not null,
  signer_user_id uuid references auth.users(id),
  signer_name text not null,
  signer_company text,
  signature_method text not null,
  signed_at timestamptz not null default now(),
  certificate_snapshot_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  unique (certificate_id, role)
);

create table public.certificate_documents (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_type text not null,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  certificate_id uuid references public.certificates(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_organization_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.create_organization_with_owner(organization_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.organizations (name)
  values (trim(organization_name))
  returning id into new_organization_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_organization_id, auth.uid(), 'owner');

  return new_organization_id;
end;
$$;

create trigger clients_touch_updated_at before update on public.clients
for each row execute function public.touch_updated_at();

create trigger certificates_touch_updated_at before update on public.certificates
for each row execute function public.touch_updated_at();

create trigger certificate_circuits_touch_updated_at before update on public.certificate_circuits
for each row execute function public.touch_updated_at();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.clients enable row level security;
alter table public.certificates enable row level security;
alter table public.certificate_circuits enable row level security;
alter table public.certificate_signatures enable row level security;
alter table public.certificate_documents enable row level security;
alter table public.audit_events enable row level security;

create policy "members can view their organizations" on public.organizations
for select using (public.is_organization_member(id));

create policy "members can view organization membership" on public.organization_members
for select using (public.is_organization_member(organization_id));

create policy "members can access clients" on public.clients
for all using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy "members can access certificates" on public.certificates
for all using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy "members can access circuits through their certificate" on public.certificate_circuits
for all using (
  exists (
    select 1 from public.certificates
    where certificates.id = certificate_circuits.certificate_id
      and public.is_organization_member(certificates.organization_id)
  )
)
with check (
  exists (
    select 1 from public.certificates
    where certificates.id = certificate_circuits.certificate_id
      and public.is_organization_member(certificates.organization_id)
  )
);

create policy "members can view certificate signatures" on public.certificate_signatures
for select using (
  exists (
    select 1 from public.certificates
    where certificates.id = certificate_signatures.certificate_id
      and public.is_organization_member(certificates.organization_id)
  )
);

create policy "members can access certificate documents" on public.certificate_documents
for all using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy "members can view audit events" on public.audit_events
for select using (public.is_organization_member(organization_id));

insert into storage.buckets (id, name, public)
values ('certificate-documents', 'certificate-documents', false)
on conflict (id) do nothing;

create policy "organization members can read certificate documents" on storage.objects
for select using (
  bucket_id = 'certificate-documents'
  and public.is_organization_member((storage.foldername(name))[1]::uuid)
);

create policy "organization members can upload certificate documents" on storage.objects
for insert with check (
  bucket_id = 'certificate-documents'
  and public.is_organization_member((storage.foldername(name))[1]::uuid)
);
