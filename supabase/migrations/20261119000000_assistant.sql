-- =============================================================
-- Asistente de ayuda: límite diario de mensajes por usuario.
-- =============================================================
create table public.assistant_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default (now() at time zone 'America/Santiago')::date,
  messages integer not null default 0,
  primary key (user_id, day)
);
alter table public.assistant_usage enable row level security;
create policy assistant_usage_own on public.assistant_usage for select using (user_id = auth.uid());

-- Suma un mensaje y devuelve cuántos quedan hoy. Si ya no quedan, no suma y devuelve -1.
create or replace function public.bump_assistant_usage(p_limit integer default 60)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v integer; v_day date := (now() at time zone 'America/Santiago')::date;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.' using errcode = '28000'; end if;
  insert into public.assistant_usage (user_id, day, messages) values (auth.uid(), v_day, 0)
  on conflict (user_id, day) do nothing;
  update public.assistant_usage set messages = messages + 1
  where user_id = auth.uid() and day = v_day and messages < p_limit
  returning messages into v;
  if v is null then return -1; end if;
  return p_limit - v;
end $$;
revoke all on function public.bump_assistant_usage from public, anon;
grant execute on function public.bump_assistant_usage to authenticated;
