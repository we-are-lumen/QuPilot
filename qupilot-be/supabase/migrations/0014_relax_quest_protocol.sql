do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'quests'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%protocol%'
  loop
    execute format('alter table public.quests drop constraint if exists %I', r.conname);
  end loop;
end $$;
