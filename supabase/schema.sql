-- ============================================================
--  VIBES — Gestion figurants & autorisations de droit à l'image
--  À coller dans Supabase → SQL Editor → Run
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Tables ----------
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  shoot_date  date,
  location    text,
  created_at  timestamptz default now()
);

create table if not exists figurants (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid references projects(id) on delete cascade,
  role               text not null default 'Figurant',   -- 'Figurant' | 'Danseur'
  first_name         text not null,
  last_name          text not null,
  dob                date,
  is_minor           boolean default false,
  email              text,
  phone              text,
  signature          text,        -- image PNG (data URL base64)
  guardian_name      text,
  guardian_relation  text,
  guardian_phone     text,
  guardian_signature text,
  present            boolean default false,
  created_at         timestamptz default now()
);

create index if not exists figurants_project_idx on figurants(project_id);

-- ---------- Row Level Security ----------
alter table projects  enable row level security;
alter table figurants enable row level security;

-- Projects : lecture publique (pour afficher le nom du projet sur le formulaire),
-- écriture réservée aux admins connectés.
drop policy if exists projects_read_all     on projects;
drop policy if exists projects_admin_insert on projects;
drop policy if exists projects_admin_update on projects;
drop policy if exists projects_admin_delete on projects;
create policy projects_read_all     on projects for select using (true);
create policy projects_admin_insert on projects for insert to authenticated with check (true);
create policy projects_admin_update on projects for update to authenticated using (true);
create policy projects_admin_delete on projects for delete to authenticated using (true);

-- Figurants : INSERT public (formulaire), mais LECTURE/MODIF réservées aux admins.
-- => personne d'autre que toi/Ange ne peut lire les données personnelles.
drop policy if exists figurants_public_insert on figurants;
drop policy if exists figurants_admin_all     on figurants;
create policy figurants_public_insert on figurants for insert to anon          with check (true);
create policy figurants_admin_all     on figurants for all    to authenticated using (true) with check (true);
