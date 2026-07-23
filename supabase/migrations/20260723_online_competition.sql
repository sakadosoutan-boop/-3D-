-- Online competition backend for Shinden 3D.
-- Anonymous users receive the `authenticated` PostgREST role after sign-in.
-- Keep all client writes behind the RPCs below; tables intentionally have no
-- policies for anon/authenticated clients.

begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(display_name) between 2 and 12),
  constraint profiles_display_name_trimmed check (display_name = btrim(display_name)),
  constraint profiles_display_name_no_control check (display_name !~ '[[:cntrl:]]')
);

create table if not exists public.scores (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null,
  score integer not null,
  duration_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint scores_mode_check check (mode in ('quiz', 'quiz_ta', 'kemari', 'koh_awase')),
  constraint scores_score_range check (score between 0 and 100000),
  constraint scores_duration_range check (duration_ms is null or duration_ms between 0 and 1800000),
  constraint scores_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists scores_mode_created_at_idx on public.scores (mode, created_at desc);
create index if not exists scores_player_created_at_idx on public.scores (player_id, created_at desc);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique,
  mode text not null,
  host_id uuid not null references public.profiles(id) on delete cascade,
  seed bigint not null,
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'waiting',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint matches_room_code_format check (room_code ~ '^[A-Z2-9]{6}$'),
  constraint matches_mode_check check (mode in ('quiz', 'quiz_ta', 'kemari', 'koh_awase')),
  constraint matches_status_check check (status in ('waiting', 'active', 'finished', 'cancelled', 'expired')),
  constraint matches_settings_object check (jsonb_typeof(settings) = 'object')
);

create index if not exists matches_status_expires_at_idx on public.matches (status, expires_at);
create index if not exists matches_room_code_idx on public.matches (room_code);

create table if not exists public.match_players (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  status text not null default 'waiting',
  display_name text not null,
  score integer not null default 0,
  duration_ms integer,
  progress jsonb not null default '{}'::jsonb,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (match_id, player_id),
  constraint match_players_role_check check (role in ('host', 'guest')),
  constraint match_players_status_check check (status in ('waiting', 'playing', 'finished', 'disconnected', 'left')),
  constraint match_players_score_range check (score between 0 and 100000),
  constraint match_players_duration_range check (duration_ms is null or duration_ms between 0 and 1800000),
  constraint match_players_progress_object check (jsonb_typeof(progress) = 'object')
);

create unique index if not exists match_players_one_host_idx
  on public.match_players (match_id) where role = 'host';
create unique index if not exists match_players_one_current_guest_idx
  on public.match_players (match_id)
  where role = 'guest' and status in ('waiting', 'playing', 'finished', 'disconnected');
create index if not exists match_players_match_idx on public.match_players (match_id, role, joined_at);

alter table public.profiles enable row level security;
alter table public.scores enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;

-- No RLS policies are created on purpose. The browser cannot read or write a
-- table directly; SECURITY DEFINER RPCs check auth.uid() and membership.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.scores from anon, authenticated;
revoke all on table public.matches from anon, authenticated;
revoke all on table public.match_players from anon, authenticated;

create or replace function public.online_require_auth()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  return v_user_id;
end;
$$;

create or replace function public.online_validate_mode(p_mode text)
returns text
language plpgsql
immutable
security definer
set search_path = public
as $$
declare
  v_mode text := lower(btrim(coalesce(p_mode, '')));
begin
  if v_mode not in ('quiz', 'quiz_ta', 'kemari', 'koh_awase') then
    raise exception 'Unsupported mode: %', coalesce(p_mode, '') using errcode = '22023';
  end if;
  return v_mode;
end;
$$;

create or replace function public.online_period_start(p_period text)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_period text := lower(btrim(coalesce(p_period, 'all_time')));
begin
  case v_period
    when 'daily' then return date_trunc('day', now());
    when 'weekly' then return date_trunc('week', now());
    when 'all_time' then return '-infinity'::timestamptz;
    else raise exception 'Unsupported ranking period: %', coalesce(p_period, '') using errcode = '22023';
  end case;
end;
$$;

create or replace function public.online_ensure_profile(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_name text;
begin
  insert into public.profiles (id, display_name)
  values (
    p_user_id,
    coalesce(nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'display_name'), ''), '客人')
  )
  on conflict (id) do nothing;

  select display_name into v_name from public.profiles where id = p_user_id;
  return v_name;
end;
$$;

create or replace function public.online_expire_stale_matches()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired integer := 0;
begin
  update public.match_players
  set status = 'disconnected'
  where status in ('waiting', 'playing')
    and last_seen_at < now() - interval '90 seconds';

  update public.matches as m
  set status = 'expired',
      finished_at = coalesce(finished_at, now()),
      updated_at = now()
  where m.status in ('waiting', 'active')
    and (
      m.expires_at <= now()
      or (
        m.status = 'active'
        and exists (
          select 1
          from public.match_players mp
          where mp.match_id = m.id
            and mp.status = 'disconnected'
            and mp.last_seen_at < now() - interval '180 seconds'
        )
      )
    );

  get diagnostics v_expired = row_count;
  return v_expired;
end;
$$;

create or replace function public.online_new_room_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  select string_agg(
    substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1),
    '' order by n
  )
  into v_code
  from generate_series(1, 6) as n;
  return v_code;
end;
$$;

create or replace function public.online_set_profile(p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.online_require_auth();
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if char_length(v_name) not between 2 and 12 or v_name ~ '[[:cntrl:]]' then
    raise exception 'Display name must be 2 to 12 visible characters' using errcode = '22023';
  end if;

  insert into public.profiles (id, display_name)
  values (v_user_id, v_name)
  on conflict (id) do update
  set display_name = excluded.display_name,
      updated_at = now();

  return jsonb_build_object('player_id', v_user_id, 'display_name', v_name);
end;
$$;

create or replace function public.online_submit_score(
  p_mode text,
  p_score integer,
  p_duration_ms integer default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.online_require_auth();
  v_mode text := public.online_validate_mode(p_mode);
  v_score_id bigint;
  v_recent_submissions integer;
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  perform public.online_ensure_profile(v_user_id);

  if p_score is null or p_score < 0 or p_score > 100000 then
    raise exception 'Score is outside the allowed range' using errcode = '22023';
  end if;
  if p_duration_ms is not null and (p_duration_ms < 0 or p_duration_ms > 1800000) then
    raise exception 'Duration is outside the allowed range' using errcode = '22023';
  end if;
  if v_mode = 'quiz_ta' and (p_duration_ms is null or p_duration_ms < 1000) then
    raise exception 'Time attack requires a duration of at least one second' using errcode = '22023';
  end if;
  if jsonb_typeof(v_metadata) <> 'object' or octet_length(v_metadata::text) > 8192 then
    raise exception 'Metadata must be an object of at most 8KB' using errcode = '22023';
  end if;

  select count(*) into v_recent_submissions
  from public.scores
  where player_id = v_user_id
    and created_at >= now() - interval '10 minutes';
  if v_recent_submissions >= 20 then
    raise exception 'Too many score submissions; please wait before trying again' using errcode = '42901';
  end if;

  insert into public.scores (player_id, mode, score, duration_ms, metadata)
  values (v_user_id, v_mode, p_score, p_duration_ms, v_metadata)
  returning id into v_score_id;

  return jsonb_build_object('score_id', v_score_id, 'mode', v_mode, 'accepted', true);
end;
$$;

create or replace function public.online_leaderboard(
  p_mode text,
  p_period text default 'all_time',
  p_limit integer default 50
)
returns table (
  rank integer,
  player_id uuid,
  display_name text,
  score integer,
  duration_ms integer,
  created_at timestamptz,
  is_me boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_mode text := public.online_validate_mode(p_mode);
  v_start timestamptz := public.online_period_start(p_period);
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 100));
  v_user_id uuid := auth.uid();
begin
  return query
  with eligible as (
    select s.player_id, p.display_name, s.score, s.duration_ms, s.created_at
    from public.scores s
    join public.profiles p on p.id = s.player_id
    where s.mode = v_mode and s.created_at >= v_start
  ), best_per_player as (
    select *, row_number() over (
      partition by player_id
      order by
        case when v_mode = 'quiz_ta' then coalesce(duration_ms, 2147483647) else 0 end asc,
        case when v_mode <> 'quiz_ta' then score else 0 end desc,
        created_at asc
    ) as player_position
    from eligible
  ), ranked as (
    select *, rank() over (
      order by
        case when v_mode = 'quiz_ta' then coalesce(duration_ms, 2147483647) else 0 end asc,
        case when v_mode <> 'quiz_ta' then score else 0 end desc,
        created_at asc
    ) as board_rank
    from best_per_player
    where player_position = 1
  )
  select board_rank::integer, ranked.player_id, ranked.display_name,
         ranked.score, ranked.duration_ms, ranked.created_at,
         ranked.player_id = v_user_id
  from ranked
  order by board_rank, created_at
  limit v_limit;
end;
$$;

create or replace function public.online_my_rank(
  p_mode text,
  p_period text default 'all_time'
)
returns table (
  rank integer,
  total_players integer,
  score integer,
  duration_ms integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.online_require_auth();
  v_mode text := public.online_validate_mode(p_mode);
  v_start timestamptz := public.online_period_start(p_period);
begin
  return query
  with eligible as (
    select s.player_id, s.score, s.duration_ms, s.created_at
    from public.scores s
    where s.mode = v_mode and s.created_at >= v_start
  ), best_per_player as (
    select *, row_number() over (
      partition by player_id
      order by
        case when v_mode = 'quiz_ta' then coalesce(duration_ms, 2147483647) else 0 end asc,
        case when v_mode <> 'quiz_ta' then score else 0 end desc,
        created_at asc
    ) as player_position
    from eligible
  ), ranked as (
    select *, rank() over (
      order by
        case when v_mode = 'quiz_ta' then coalesce(duration_ms, 2147483647) else 0 end asc,
        case when v_mode <> 'quiz_ta' then score else 0 end desc,
        created_at asc
    ) as board_rank,
    count(*) over () as board_size
    from best_per_player
    where player_position = 1
  )
  select board_rank::integer, board_size::integer, ranked.score,
         ranked.duration_ms, ranked.created_at
  from ranked
  where ranked.player_id = v_user_id;
end;
$$;

create or replace function public.online_create_match(
  p_mode text,
  p_expires_in_seconds integer default 600,
  p_settings jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.online_require_auth();
  v_mode text := public.online_validate_mode(p_mode);
  v_name text;
  v_seconds integer := greatest(60, least(coalesce(p_expires_in_seconds, 600), 1800));
  v_settings jsonb := coalesce(p_settings, '{}'::jsonb);
  v_match_id uuid;
  v_room_code text;
  v_seed bigint;
  v_expires_at timestamptz := now() + make_interval(secs => v_seconds);
  v_attempt integer;
begin
  perform public.online_ensure_profile(v_user_id);
  select display_name into v_name from public.profiles where id = v_user_id;

  if jsonb_typeof(v_settings) <> 'object' or octet_length(v_settings::text) > 4096 then
    raise exception 'Match settings must be an object of at most 4KB' using errcode = '22023';
  end if;

  perform public.online_expire_stale_matches();
  v_seed := floor(random() * 2147483647)::bigint;

  for v_attempt in 1..8 loop
    v_room_code := public.online_new_room_code();
    begin
      insert into public.matches (room_code, mode, host_id, seed, settings, expires_at)
      values (v_room_code, v_mode, v_user_id, v_seed, v_settings, v_expires_at)
      returning id into v_match_id;
      exit;
    exception when unique_violation then
      v_match_id := null;
    end;
  end loop;

  if v_match_id is null then
    raise exception 'Could not create a unique room code; please retry' using errcode = '40001';
  end if;

  insert into public.match_players (match_id, player_id, role, display_name)
  values (v_match_id, v_user_id, 'host', v_name);

  return jsonb_build_object(
    'match_id', v_match_id,
    'room_code', v_room_code,
    'mode', v_mode,
    'seed', v_seed,
    'status', 'waiting',
    'expires_at', v_expires_at
  );
end;
$$;

create or replace function public.online_match_state(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.online_require_auth();
  v_match public.matches%rowtype;
  v_member_status text;
  v_players jsonb;
begin
  perform public.online_expire_stale_matches();

  select * into v_match from public.matches where id = p_match_id;
  if not found then
    raise exception 'Match was not found' using errcode = 'P0002';
  end if;

  select status into v_member_status
  from public.match_players
  where match_id = p_match_id and player_id = v_user_id;
  if not found then
    raise exception 'Only match participants can read this room' using errcode = '42501';
  end if;

  if v_match.status in ('waiting', 'active') and v_member_status <> 'left' then
    update public.match_players
    set last_seen_at = now(),
        status = case
          when status = 'disconnected' and v_match.status = 'waiting' then 'waiting'
          when status = 'disconnected' and v_match.status = 'active' then 'playing'
          else status
        end
    where match_id = p_match_id and player_id = v_user_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'player_id', mp.player_id,
    'display_name', mp.display_name,
    'role', mp.role,
    'is_host', mp.role = 'host',
    'is_self', mp.player_id = v_user_id,
    'status', mp.status,
    'score', mp.score,
    'duration_ms', mp.duration_ms,
    'progress', mp.progress,
    'last_seen_at', mp.last_seen_at,
    'finished_at', mp.finished_at
  ) order by case mp.role when 'host' then 0 else 1 end, mp.joined_at), '[]'::jsonb)
  into v_players
  from public.match_players mp
  where mp.match_id = p_match_id;

  return jsonb_build_object(
    'match_id', v_match.id,
    'room_code', v_match.room_code,
    'mode', v_match.mode,
    'seed', v_match.seed,
    'settings', v_match.settings,
    'status', v_match.status,
    'host_id', v_match.host_id,
    'created_at', v_match.created_at,
    'started_at', v_match.started_at,
    'finished_at', v_match.finished_at,
    'expires_at', v_match.expires_at,
    'players', v_players
  );
end;
$$;

create or replace function public.online_join_match(p_room_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.online_require_auth();
  v_code text := upper(btrim(coalesce(p_room_code, '')));
  v_match public.matches%rowtype;
  v_name text;
  v_current_guest_count integer;
  v_existing_status text;
begin
  if v_code !~ '^[A-Z2-9]{6}$' then
    raise exception 'Room code must be six characters' using errcode = '22023';
  end if;

  perform public.online_ensure_profile(v_user_id);
  select display_name into v_name from public.profiles where id = v_user_id;
  perform public.online_expire_stale_matches();

  select * into v_match from public.matches where room_code = v_code for update;
  if not found then
    raise exception 'Room was not found' using errcode = 'P0002';
  end if;
  if v_match.status <> 'waiting' or v_match.expires_at <= now() then
    raise exception 'This room is no longer accepting players' using errcode = '55000';
  end if;

  select status into v_existing_status
  from public.match_players
  where match_id = v_match.id and player_id = v_user_id;
  if found then
    if v_existing_status <> 'left' then
      return public.online_match_state(v_match.id);
    end if;
    delete from public.match_players
    where match_id = v_match.id and player_id = v_user_id and status = 'left';
  end if;
  if v_match.host_id = v_user_id then
    raise exception 'The host is already in this room' using errcode = '22023';
  end if;

  select count(*) into v_current_guest_count
  from public.match_players
  where match_id = v_match.id
    and role = 'guest'
    and status in ('waiting', 'playing', 'finished', 'disconnected');
  if v_current_guest_count > 0 then
    raise exception 'This room already has a guest' using errcode = '23505';
  end if;

  insert into public.match_players (match_id, player_id, role, display_name)
  values (v_match.id, v_user_id, 'guest', v_name);

  return public.online_match_state(v_match.id);
end;
$$;

create or replace function public.online_start_match(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.online_require_auth();
  v_match public.matches%rowtype;
  v_ready_players integer;
begin
  perform public.online_expire_stale_matches();
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'Match was not found' using errcode = 'P0002';
  end if;
  if v_match.host_id <> v_user_id then
    raise exception 'Only the host can start this match' using errcode = '42501';
  end if;
  if v_match.status <> 'waiting' then
    raise exception 'This match cannot be started' using errcode = '55000';
  end if;

  select count(*) into v_ready_players
  from public.match_players
  where match_id = p_match_id and status = 'waiting';
  if v_ready_players <> 2 then
    raise exception 'Exactly two waiting players are required to start' using errcode = '55000';
  end if;

  update public.matches
  set status = 'active',
      started_at = now(),
      expires_at = greatest(expires_at, now() + interval '20 minutes'),
      updated_at = now()
  where id = p_match_id;
  update public.match_players
  set status = 'playing', last_seen_at = now()
  where match_id = p_match_id and status = 'waiting';

  return public.online_match_state(p_match_id);
end;
$$;

create or replace function public.online_update_match_player(
  p_match_id uuid,
  p_score integer,
  p_duration_ms integer default null,
  p_progress jsonb default '{}'::jsonb,
  p_finished boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.online_require_auth();
  v_match public.matches%rowtype;
  v_progress jsonb := coalesce(p_progress, '{}'::jsonb);
  v_unfinished integer;
  v_player_status text;
begin
  perform public.online_expire_stale_matches();
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'Match was not found' using errcode = 'P0002';
  end if;
  if v_match.status <> 'active' then
    raise exception 'Only active matches accept progress updates' using errcode = '55000';
  end if;
  select status into v_player_status
  from public.match_players
  where match_id = p_match_id and player_id = v_user_id;
  if not found or v_player_status not in ('playing', 'finished') then
    raise exception 'Only active participants can update their progress' using errcode = '42501';
  end if;
  if v_player_status = 'finished' and not p_finished then
    raise exception 'A finished result cannot be reopened' using errcode = '55000';
  end if;
  if p_score is null or p_score < 0 or p_score > 100000 then
    raise exception 'Score is outside the allowed range' using errcode = '22023';
  end if;
  if p_duration_ms is not null and (p_duration_ms < 0 or p_duration_ms > 1800000) then
    raise exception 'Duration is outside the allowed range' using errcode = '22023';
  end if;
  if jsonb_typeof(v_progress) <> 'object' or octet_length(v_progress::text) > 4096 then
    raise exception 'Progress must be an object of at most 4KB' using errcode = '22023';
  end if;

  update public.match_players
  set score = p_score,
      duration_ms = p_duration_ms,
      progress = v_progress,
      status = case when p_finished then 'finished' else 'playing' end,
      last_seen_at = now(),
      finished_at = case when p_finished then coalesce(finished_at, now()) else null end
  where match_id = p_match_id and player_id = v_user_id;

  if p_finished then
    select count(*) into v_unfinished
    from public.match_players
    where match_id = p_match_id and status in ('waiting', 'playing');
    if v_unfinished = 0 then
      update public.matches
      set status = 'finished', finished_at = now(), updated_at = now()
      where id = p_match_id and status = 'active';
    end if;
  end if;

  return public.online_match_state(p_match_id);
end;
$$;

create or replace function public.online_leave_match(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.online_require_auth();
  v_match public.matches%rowtype;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'Match was not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.match_players where match_id = p_match_id and player_id = v_user_id
  ) then
    raise exception 'Only match participants can leave this room' using errcode = '42501';
  end if;

  update public.match_players
  set status = 'left', last_seen_at = now()
  where match_id = p_match_id and player_id = v_user_id;

  if v_match.status = 'waiting' and v_match.host_id = v_user_id then
    update public.matches
    set status = 'cancelled', finished_at = now(), updated_at = now()
    where id = p_match_id;
  elsif v_match.status = 'active' then
    update public.matches
    set status = 'cancelled', finished_at = now(), updated_at = now()
    where id = p_match_id;
  end if;

  return public.online_match_state(p_match_id);
end;
$$;

revoke all on function public.online_require_auth() from public;
revoke all on function public.online_validate_mode(text) from public;
revoke all on function public.online_period_start(text) from public;
revoke all on function public.online_ensure_profile(uuid) from public;
revoke all on function public.online_expire_stale_matches() from public;
revoke all on function public.online_new_room_code() from public;
revoke all on function public.online_set_profile(text) from public;
revoke all on function public.online_submit_score(text, integer, integer, jsonb) from public;
revoke all on function public.online_leaderboard(text, text, integer) from public;
revoke all on function public.online_my_rank(text, text) from public;
revoke all on function public.online_create_match(text, integer, jsonb) from public;
revoke all on function public.online_match_state(uuid) from public;
revoke all on function public.online_join_match(text) from public;
revoke all on function public.online_start_match(uuid) from public;
revoke all on function public.online_update_match_player(uuid, integer, integer, jsonb, boolean) from public;
revoke all on function public.online_leave_match(uuid) from public;

grant usage on schema public to authenticated;
grant execute on function public.online_set_profile(text) to authenticated;
grant execute on function public.online_submit_score(text, integer, integer, jsonb) to authenticated;
grant execute on function public.online_leaderboard(text, text, integer) to authenticated;
grant execute on function public.online_my_rank(text, text) to authenticated;
grant execute on function public.online_create_match(text, integer, jsonb) to authenticated;
grant execute on function public.online_match_state(uuid) to authenticated;
grant execute on function public.online_join_match(text) to authenticated;
grant execute on function public.online_start_match(uuid) to authenticated;
grant execute on function public.online_update_match_player(uuid, integer, integer, jsonb, boolean) to authenticated;
grant execute on function public.online_leave_match(uuid) to authenticated;

commit;
