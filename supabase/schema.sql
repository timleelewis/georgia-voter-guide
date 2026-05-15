-- ============================================================
-- Georgia Voter Guide — Supabase Schema
-- Run this in Supabase > SQL Editor > New Query
-- ============================================================

-- 1. USER PROFILES (auto-created when someone signs up)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  created_at timestamptz default now(),
  
  -- Access window
  access_start timestamptz default now(),
  access_end timestamptz default (now() + interval '30 days'),
  access_type text default 'trial', -- 'trial' | 'donor' | 'election_window' | 'permanent'
  
  -- Usage tracking
  total_searches integer default 0,
  daily_searches integer default 0,
  last_search_date date default current_date,
  search_limit integer default 50, -- searches allowed per day
  
  -- Status
  is_active boolean default true,
  is_banned boolean default false,
  ban_reason text
);

-- 2. SEARCH LOG (every search recorded for abuse detection)
create table if not exists public.search_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  query text not null,
  response_length integer,
  was_blocked boolean default false,
  block_reason text,
  created_at timestamptz default now(),
  ip_hash text -- store hashed IP only, not raw
);

-- 3. ELECTION WINDOWS (admin-defined open access periods)
create table if not exists public.election_windows (
  id uuid default gen_random_uuid() primary key,
  name text not null, -- e.g. "2026 Georgia Midterms"
  window_start timestamptz not null,
  window_end timestamptz not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Insert the current election window (update dates as needed)
insert into public.election_windows (name, window_start, window_end)
values (
  '2026 Georgia General Election',
  '2026-09-01 00:00:00+00',
  '2026-11-04 23:59:59+00'
);

-- 4. DONATIONS (optional — track supporters)
create table if not exists public.donations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  amount_cents integer not null,
  currency text default 'usd',
  stripe_payment_id text,
  access_days_granted integer default 365,
  created_at timestamptz default now()
);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-create profile when user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

-- Trigger: fires on every new auth signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function: check if user has access (within window + not banned + has searches left)
create or replace function public.check_user_access(p_user_id uuid)
returns json language plpgsql security definer as $$
declare
  v_profile public.profiles%rowtype;
  v_in_election_window boolean;
  v_result json;
begin
  select * into v_profile from public.profiles where id = p_user_id;

  if not found then
    return json_build_object('allowed', false, 'reason', 'User not found');
  end if;

  if v_profile.is_banned then
    return json_build_object('allowed', false, 'reason', 'Account suspended: ' || coalesce(v_profile.ban_reason, 'policy violation'));
  end if;

  -- Check if inside an active election window (overrides trial expiry)
  select exists(
    select 1 from public.election_windows
    where is_active = true
      and now() between window_start and window_end
  ) into v_in_election_window;

  -- Reset daily count if new day
  if v_profile.last_search_date < current_date then
    update public.profiles
    set daily_searches = 0, last_search_date = current_date
    where id = p_user_id;
    v_profile.daily_searches := 0;
  end if;

  -- Check daily limit
  if v_profile.daily_searches >= v_profile.search_limit then
    return json_build_object(
      'allowed', false,
      'reason', 'Daily search limit reached. Resets at midnight.',
      'daily_searches', v_profile.daily_searches,
      'search_limit', v_profile.search_limit
    );
  end if;

  -- Check access window (unless in election window)
  if not v_in_election_window and now() > v_profile.access_end then
    return json_build_object(
      'allowed', false,
      'reason', 'Trial period ended. Access reopens during election windows.',
      'access_end', v_profile.access_end
    );
  end if;

  return json_build_object(
    'allowed', true,
    'access_type', v_profile.access_type,
    'searches_today', v_profile.daily_searches,
    'searches_remaining', v_profile.search_limit - v_profile.daily_searches,
    'access_end', v_profile.access_end,
    'in_election_window', v_in_election_window
  );
end;
$$;

-- Function: increment search count after a successful search
create or replace function public.record_search(p_user_id uuid, p_query text, p_response_length integer)
returns void language plpgsql security definer as $$
begin
  update public.profiles
  set
    total_searches = total_searches + 1,
    daily_searches = daily_searches + 1,
    last_search_date = current_date
  where id = p_user_id;

  insert into public.search_log (user_id, query, response_length)
  values (p_user_id, left(p_query, 200), p_response_length);
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY (users can only see their own data)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.search_log enable row level security;

create policy "Users see own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users see own searches" on public.search_log
  for select using (auth.uid() = user_id);

-- Election windows are public (read only)
alter table public.election_windows enable row level security;
create policy "Anyone can view election windows" on public.election_windows
  for select using (true);

-- ============================================================
-- Done! Your schema is ready.
-- ============================================================
