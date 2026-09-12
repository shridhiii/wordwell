create table if not exists public.user_words (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  term text not null,
  definition text not null,
  note text not null default '',
  level integer not null default 0,
  next_review bigint not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.daily_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.families (
  id uuid primary key,
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create table if not exists public.completed_words (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id text not null,
  completed_at timestamptz not null default now()
);

alter table public.user_words enable row level security;
alter table public.daily_claims enable row level security;
alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.completed_words enable row level security;

create or replace function public.shares_family(target_user uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.family_members mine
    join public.family_members theirs on mine.family_id = theirs.family_id
    where mine.user_id = auth.uid() and theirs.user_id = target_user
  );
$$;

create policy "Users can read profiles in their family"
  on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.shares_family(user_id));

create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users can read families they belong to"
  on public.families for select to authenticated
  using (created_by = auth.uid() or exists (
    select 1 from public.family_members where family_id = families.id and user_id = auth.uid()
  ));

create policy "Users can create families"
  on public.families for insert to authenticated
  with check (created_by = auth.uid());

create policy "Users can read their family memberships"
  on public.family_members for select to authenticated
  using (user_id = auth.uid() or public.shares_family(user_id));

create policy "Users can join families"
  on public.family_members for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can read family completions"
  on public.completed_words for select to authenticated
  using (user_id = auth.uid() or public.shares_family(user_id));

create policy "Users can record their own completions"
  on public.completed_words for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can read their own daily claims"
  on public.daily_claims for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their own daily claims"
  on public.daily_claims for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can read their own words"
  on public.user_words for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can add their own words"
  on public.user_words for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own words"
  on public.user_words for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own words"
  on public.user_words for delete to authenticated
  using (auth.uid() = user_id);
