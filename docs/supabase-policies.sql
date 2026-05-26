grant usage on schema public to anon;
grant select, insert, update, delete on game_sessions to anon;
grant select, insert, update, delete on teams to anon;
grant select, insert, update, delete on participants to anon;
grant select, insert, update, delete on game_events to anon;

alter table game_sessions enable row level security;
alter table teams enable row level security;
alter table participants enable row level security;
alter table game_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'game_sessions'
      and policyname = 'classroom anon can manage game sessions'
  ) then
    create policy "classroom anon can manage game sessions"
      on game_sessions
      for all
      to anon
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'teams'
      and policyname = 'classroom anon can manage teams'
  ) then
    create policy "classroom anon can manage teams"
      on teams
      for all
      to anon
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'participants'
      and policyname = 'classroom anon can manage participants'
  ) then
    create policy "classroom anon can manage participants"
      on participants
      for all
      to anon
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'game_events'
      and policyname = 'classroom anon can manage game events'
  ) then
    create policy "classroom anon can manage game events"
      on game_events
      for all
      to anon
      using (true)
      with check (true);
  end if;
end $$;
