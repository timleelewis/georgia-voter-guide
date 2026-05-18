-- ============================================================
-- Georgia Qualified Candidates — Supabase Schema + Import
-- Run this in Supabase > SQL Editor > New Query
-- ============================================================

-- 1. CREATE THE TABLE
create table if not exists public.qualified_candidates (
  id uuid default gen_random_uuid() primary key,
  contest_name text,
  county text,
  municipality text,
  candidate_name text not null,
  candidate_status text, -- Qualified, Withdrawn, Disqualified
  political_party text,
  qualified_date date,
  incumbent boolean default false,
  occupation text,
  email_address text,
  website text,
  created_at timestamptz default now()
);

-- 2. ENABLE ROW LEVEL SECURITY
alter table public.qualified_candidates enable row level security;

-- Anyone can read candidates (public data)
create policy "Anyone can view candidates"
  on public.qualified_candidates
  for select using (true);

-- 3. CREATE SEARCH INDEX for fast candidate name lookups
create index if not exists idx_candidates_name
  on public.qualified_candidates
  using gin(to_tsvector('english', candidate_name));

create index if not exists idx_candidates_contest
  on public.qualified_candidates
  using gin(to_tsvector('english', contest_name));

create index if not exists idx_candidates_county
  on public.qualified_candidates (county);

create index if not exists idx_candidates_status
  on public.qualified_candidates (candidate_status);

-- ============================================================
-- 4. IMPORT THE CSV DATA
-- Copy this section and run AFTER creating the table above
-- In Supabase: Table Editor > qualified_candidates > Insert > Import CSV
-- Upload your Qualified_Candidates.csv file directly
-- Column mapping:
--   CONTEST NAME      → contest_name
--   COUNTY            → county
--   MUNICIPALITY      → municipality
--   CANDIDATE NAME    → candidate_name
--   CANDIDATE STATUS  → candidate_status
--   POLITICAL PARTY   → political_party
--   QUALIFIED DATE    → qualified_date
--   INCUMBENT         → incumbent (YES=true, NO=false)
--   OCCUPATION        → occupation
--   EMAIL ADDRESS     → email_address
--   WEBSITE           → website
-- ============================================================

-- 5. SEARCH FUNCTION — used by your API to find candidates
-- Returns candidates matching a name or contest search
create or replace function public.search_candidates(search_term text)
returns table (
  id uuid,
  contest_name text,
  county text,
  municipality text,
  candidate_name text,
  candidate_status text,
  political_party text,
  qualified_date date,
  incumbent boolean,
  occupation text,
  email_address text,
  website text
) language plpgsql security definer as $$
begin
  return query
  select
    c.id,
    c.contest_name,
    c.county,
    c.municipality,
    c.candidate_name,
    c.candidate_status,
    c.political_party,
    c.qualified_date,
    c.incumbent,
    c.occupation,
    c.email_address,
    c.website
  from public.qualified_candidates c
  where
    -- Search by candidate name OR contest name OR county
    (
      c.candidate_name ilike '%' || search_term || '%'
      or c.contest_name ilike '%' || search_term || '%'
      or c.county ilike '%' || search_term || '%'
      or c.municipality ilike '%' || search_term || '%'
    )
    -- Only show qualified candidates by default
    and c.candidate_status = 'Qualified'
  order by
    -- Exact name matches first
    case when c.candidate_name ilike search_term then 0 else 1 end,
    c.county,
    c.contest_name,
    c.candidate_name
  limit 20;
end;
$$;

-- 6. COUNTY LOOKUP — find all candidates in a county
create or replace function public.candidates_by_county(p_county text)
returns table (
  contest_name text,
  candidate_name text,
  candidate_status text,
  political_party text,
  incumbent boolean,
  occupation text,
  website text
) language plpgsql security definer as $$
begin
  return query
  select
    c.contest_name,
    c.candidate_name,
    c.candidate_status,
    c.political_party,
    c.incumbent,
    c.occupation,
    c.website
  from public.qualified_candidates c
  where
    c.county ilike '%' || p_county || '%'
    and c.candidate_status = 'Qualified'
  order by c.contest_name, c.candidate_name;
end;
$$;

-- ============================================================
-- VERIFY IMPORT WORKED — run this after importing CSV
-- ============================================================
-- select count(*) from public.qualified_candidates;
-- Should return ~640+ rows

-- Test search function:
-- select * from public.search_candidates('FULTON');
-- select * from public.search_candidates('judge');
