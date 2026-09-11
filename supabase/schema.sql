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

alter table public.user_words enable row level security;
alter table public.daily_claims enable row level security;

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
