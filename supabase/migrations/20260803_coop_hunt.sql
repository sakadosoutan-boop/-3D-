-- Two-player cooperative boss hunt for the existing online room system.
-- Clients may only use the RPCs at the bottom of this file. Boss HP, damage,
-- cooldowns, event ordering, and reconnect snapshots are all server-owned.

begin;

-- Keep the existing generic room RPC contract intact while allowing it to
-- create coop_hunt rooms. Co-op contribution is deliberately excluded from
-- the generic score table because it is calculated by the action RPC.
alter table public.scores drop constraint if exists scores_mode_check;
alter table public.scores
  add constraint scores_mode_check
  check (mode in ('gozen5', 'quiz', 'quiz_ta', 'kemari', 'koh_awase'));

alter table public.matches drop constraint if exists matches_mode_check;
alter table public.matches
  add constraint matches_mode_check
  check (mode in ('coop_hunt', 'gozen5', 'quiz', 'quiz_ta', 'kemari', 'koh_awase'));

create table if not exists public.coop_hunt_runs (
  match_id uuid primary key references public.matches(id) on delete cascade,
  boss_key text not null default 'nine_tails',
  max_boss_hp integer not null,
  boss_hp integer not null,
  phase integer not null default 1,
  event_sequence bigint not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint coop_hunt_runs_boss_key_check check (boss_key in ('nine_tails', 'kappa', 'souls', 'snow_queen')),
  constraint coop_hunt_runs_max_hp_check check (max_boss_hp between 1000 and 20000),
  constraint coop_hunt_runs_hp_check check (boss_hp between 0 and max_boss_hp),
  constraint coop_hunt_runs_phase_check check (phase between 1 and 4),
  constraint coop_hunt_runs_sequence_check check (event_sequence >= 0),
  constraint coop_hunt_runs_status_check check (status in ('active', 'defeated', 'failed'))
);

create table if not exists public.coop_hunt_actions (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  action_id text not null,
  sequence bigint not null,
  action_type text not null,
  damage integer not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint coop_hunt_actions_action_id_check
    check (action_id ~ '^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$'),
  constraint coop_hunt_actions_type_check check (action_type in ('attack', 'focus', 'guard', 'down')),
  constraint coop_hunt_actions_damage_check check (damage between 0 and 1000),
  constraint coop_hunt_actions_payload_object_check check (jsonb_typeof(payload) = 'object'),
  constraint coop_hunt_actions_match_action_unique unique (match_id, action_id),
  constraint coop_hunt_actions_match_sequence_unique unique (match_id, sequence)
);

-- Keep reruns and partially-applied development databases compatible with the
-- final season/down vocabulary. No migration with this name was published
-- before this definition, but explicit replacement makes SQL Editor retries safe.
update public.coop_hunt_runs r
set boss_key = case lower(coalesce(m.settings ->> 'season', 'spring'))
  when 'summer' then 'kappa' when 'autumn' then 'souls'
  when 'winter' then 'snow_queen' else 'nine_tails' end
from public.matches m
where m.id = r.match_id
  and r.boss_key not in ('nine_tails', 'kappa', 'souls', 'snow_queen');
alter table public.coop_hunt_runs alter column boss_key set default 'nine_tails';
alter table public.coop_hunt_runs drop constraint if exists coop_hunt_runs_boss_key_check;
alter table public.coop_hunt_runs
  add constraint coop_hunt_runs_boss_key_check check (boss_key in ('nine_tails', 'kappa', 'souls', 'snow_queen'));
alter table public.coop_hunt_actions drop constraint if exists coop_hunt_actions_type_check;
alter table public.coop_hunt_actions
  add constraint coop_hunt_actions_type_check check (action_type in ('attack', 'focus', 'guard', 'down'));

create index if not exists coop_hunt_actions_match_sequence_idx
  on public.coop_hunt_actions (match_id, sequence desc);
create index if not exists coop_hunt_actions_player_cooldown_idx
  on public.coop_hunt_actions (match_id, player_id, action_type, created_at desc);

alter table public.coop_hunt_runs enable row level security;
alter table public.coop_hunt_actions enable row level security;

-- There are deliberately no RLS policies. Browser roles cannot inspect or
-- mutate hunt state outside the membership-checked SECURITY DEFINER RPCs.
revoke all on table public.coop_hunt_runs from public, anon, authenticated;
revoke all on table public.coop_hunt_actions from public, anon, authenticated;
revoke all on sequence public.coop_hunt_actions_id_seq from public, anon, authenticated;

create or replace function public.online_validate_mode(p_mode text)
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_mode text := lower(btrim(coalesce(p_mode, '')));
begin
  if v_mode not in ('coop_hunt', 'gozen5', 'quiz', 'quiz_ta', 'kemari', 'koh_awase') then
    raise exception 'Unsupported mode: %', coalesce(p_mode, '') using errcode = '22023';
  end if;
  return v_mode;
end;
$$;

-- This helper is intentionally private. A run is created only after the
-- generic room becomes active, so waiting rooms remain unchanged.
create or replace function public.coop_hunt_ensure_run(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.coop_hunt_runs (
    match_id, boss_key, max_boss_hp, boss_hp, phase, status
  )
  select
    m.id,
    case lower(coalesce(m.settings ->> 'season', 'spring'))
      when 'summer' then 'kappa'
      when 'autumn' then 'souls'
      when 'winter' then 'snow_queen'
      else 'nine_tails'
    end,
    (case lower(coalesce(m.settings ->> 'season', 'spring'))
      when 'summer' then 5000 when 'autumn' then 4600 when 'winter' then 4400 else 4700
    end * case when lower(coalesce(m.settings ->> 'difficulty', 'normal')) = 'hard' then 14 else 10 end / 10),
    (case lower(coalesce(m.settings ->> 'season', 'spring'))
      when 'summer' then 5000 when 'autumn' then 4600 when 'winter' then 4400 else 4700
    end * case when lower(coalesce(m.settings ->> 'difficulty', 'normal')) = 'hard' then 14 else 10 end / 10),
    1,
    'active'
  from public.matches m
  where m.id = p_match_id
    and m.mode = 'coop_hunt'
    and m.status in ('active', 'finished')
  on conflict (match_id) do nothing;
end;
$$;

-- Build a reconnect-safe view after the caller has proved membership. The
-- last 20 actions are returned in sequence order so a client can catch up
-- without simulating remote player movement.
create or replace function public.coop_hunt_build_state(
  p_match_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_run public.coop_hunt_runs%rowtype;
  v_has_run boolean := false;
  v_players jsonb;
  v_actions jsonb;
  v_boss jsonb;
begin
  select * into v_match
  from public.matches m
  where m.id = p_match_id;

  select * into v_run
  from public.coop_hunt_runs r
  where r.match_id = p_match_id;
  v_has_run := found;

  select coalesce(jsonb_agg(jsonb_build_object(
    'player_id', mp.player_id,
    'display_name', mp.display_name,
    'role', mp.role,
    'is_self', mp.player_id = p_user_id,
    'status', mp.status,
    'contribution', mp.score,
    'down', coalesce(mp.progress ->> 'down', 'false') = 'true',
    'last_seen_at', mp.last_seen_at
  ) order by case mp.role when 'host' then 0 else 1 end, mp.joined_at), '[]'::jsonb)
  into v_players
  from public.match_players mp
  where mp.match_id = p_match_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'sequence', recent.sequence,
    'action_id', recent.action_id,
    'player_id', recent.player_id,
    'display_name', recent.display_name,
    'action_type', recent.action_type,
    'damage', recent.damage,
    'payload', recent.payload,
    'created_at', recent.created_at
  ) order by recent.sequence), '[]'::jsonb)
  into v_actions
  from (
    select a.sequence, a.action_id, a.player_id, mp.display_name,
           a.action_type, a.damage, a.payload, a.created_at
    from public.coop_hunt_actions a
    join public.match_players mp
      on mp.match_id = a.match_id and mp.player_id = a.player_id
    where a.match_id = p_match_id
    order by a.sequence desc
    limit 20
  ) recent;

  if v_has_run then
    v_boss := jsonb_build_object(
      'key', v_run.boss_key,
      'max_hp', v_run.max_boss_hp,
      'hp', v_run.boss_hp,
      'phase', v_run.phase,
      'status', v_run.status
    );
  else
    v_boss := null;
  end if;

  return jsonb_build_object(
    'match_id', v_match.id,
    'room_code', v_match.room_code,
    'mode', v_match.mode,
    'status', v_match.status,
    'seed', v_match.seed,
    'settings', v_match.settings,
    'started_at', v_match.started_at,
    'finished_at', v_match.finished_at,
    'expires_at', v_match.expires_at,
    'boss', v_boss,
    'event_sequence', case when v_has_run then v_run.event_sequence else 0 end,
    'players', v_players,
    'recent_actions', v_actions,
    'snapshot', jsonb_build_object(
      'event_sequence', case when v_has_run then v_run.event_sequence else 0 end,
      'boss', v_boss,
      'players', v_players,
      'recent_actions', v_actions
    )
  );
end;
$$;

create or replace function public.coop_hunt_state(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := public.online_require_auth();
  v_match public.matches%rowtype;
  v_member_status text;
begin
  perform public.online_expire_stale_matches();

  select * into v_match
  from public.matches m
  where m.id = p_match_id;
  if not found then
    raise exception 'Match was not found' using errcode = 'P0002';
  end if;
  if v_match.mode <> 'coop_hunt' then
    raise exception 'This is not a cooperative hunt room' using errcode = '22023';
  end if;

  select mp.status into v_member_status
  from public.match_players mp
  where mp.match_id = p_match_id and mp.player_id = v_user_id;
  if not found or v_member_status = 'left' then
    raise exception 'Only match participants can read this hunt' using errcode = '42501';
  end if;

  if v_match.status in ('active', 'finished') then
    perform public.coop_hunt_ensure_run(p_match_id);
  end if;

  if v_match.status = 'active' then
    update public.match_players
    set last_seen_at = now(),
        status = case when status = 'disconnected' then 'playing' else status end
    where match_id = p_match_id and player_id = v_user_id;
  end if;

  return public.coop_hunt_build_state(p_match_id, v_user_id);
end;
$$;

create or replace function public.coop_hunt_submit_action(
  p_match_id uuid,
  p_action_id text,
  p_action_type text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := public.online_require_auth();
  v_match public.matches%rowtype;
  v_run public.coop_hunt_runs%rowtype;
  v_member_status text;
  v_member_down boolean := false;
  v_action_id text := btrim(coalesce(p_action_id, ''));
  v_action_type text := lower(btrim(coalesce(p_action_type, '')));
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_timing_raw text;
  v_timing integer := 500;
  v_damage integer;
  v_applied_damage integer;
  v_cooldown_ms integer;
  v_last_action_at timestamptz;
  v_sequence bigint;
  v_next_hp integer;
  v_next_phase integer;
  v_finished boolean := false;
  v_failed boolean := false;
  v_existing_id bigint;
  v_state jsonb;
begin
  if v_action_id !~ '^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$' then
    raise exception 'Action ID must be 8 to 128 URL-safe characters' using errcode = '22023';
  end if;
  if v_action_type not in ('attack', 'focus', 'guard', 'down') then
    raise exception 'Unsupported hunt action: %', coalesce(p_action_type, '') using errcode = '22023';
  end if;
  if jsonb_typeof(v_payload) <> 'object' or octet_length(v_payload::text) > 2048 then
    raise exception 'Action payload must be an object of at most 2KB' using errcode = '22023';
  end if;

  v_timing_raw := coalesce(v_payload ->> 'timing', '500');
  if v_timing_raw !~ '^[0-9]{1,4}$' then
    raise exception 'Action timing must be an integer from 0 to 1000' using errcode = '22023';
  end if;
  v_timing := greatest(0, least(v_timing_raw::integer, 1000));

  -- Serialise actions on the shared run row. This is the authoritative order
  -- for HP updates and makes retries safe after an interrupted response.
  perform public.online_expire_stale_matches();
  select * into v_match
  from public.matches m
  where m.id = p_match_id
  for update;
  if not found then
    raise exception 'Match was not found' using errcode = 'P0002';
  end if;
  if v_match.mode <> 'coop_hunt' then
    raise exception 'This is not a cooperative hunt room' using errcode = '22023';
  end if;
  select mp.status, coalesce(mp.progress ->> 'down', 'false') = 'true'
  into v_member_status, v_member_down
  from public.match_players mp
  where mp.match_id = p_match_id and mp.player_id = v_user_id;
  if not found or v_member_status = 'left' then
    raise exception 'Only match participants can act' using errcode = '42501';
  end if;

  -- A response can be lost after the final hit changes the match to finished.
  -- Return the already accepted state before enforcing the active-room gate.
  select a.id into v_existing_id
  from public.coop_hunt_actions a
  where a.match_id = p_match_id and a.action_id = v_action_id;
  if found then
    v_state := public.coop_hunt_build_state(p_match_id, v_user_id);
    return v_state || jsonb_build_object(
      'accepted', true,
      'duplicate', true,
      'action_id', v_action_id
    );
  end if;

  if v_match.status <> 'active' then
    raise exception 'Only active hunt rooms accept actions' using errcode = '55000';
  end if;
  if v_member_status not in ('playing', 'disconnected') or v_member_down then
    raise exception 'A downed or finished participant cannot act' using errcode = '42501';
  end if;

  perform public.coop_hunt_ensure_run(p_match_id);
  select * into v_run
  from public.coop_hunt_runs r
  where r.match_id = p_match_id
  for update;
  if v_run.status <> 'active' then
    raise exception 'This hunt is already complete' using errcode = '55000';
  end if;

  case v_action_type
    when 'attack' then
      v_cooldown_ms := 650;
      v_damage := 100 + (v_timing / 100) * 10;
    when 'focus' then
      v_cooldown_ms := 1800;
      v_damage := 240 + (v_timing / 200) * 20;
    when 'guard' then
      v_cooldown_ms := 900;
      v_damage := 35 + (v_timing / 250) * 5;
    when 'down' then
      v_cooldown_ms := 0;
      v_damage := 0;
  end case;

  select a.created_at into v_last_action_at
  from public.coop_hunt_actions a
  where a.match_id = p_match_id
    and a.player_id = v_user_id
    and a.action_type = v_action_type
  order by a.created_at desc
  limit 1;
  if v_action_type <> 'down' and found and v_last_action_at > now() - ((v_cooldown_ms::text || ' milliseconds')::interval) then
    raise exception 'Action is cooling down; retry shortly' using errcode = '55000';
  end if;

  v_sequence := v_run.event_sequence + 1;
  v_applied_damage := least(v_damage, v_run.boss_hp);
  v_next_hp := greatest(v_run.boss_hp - v_applied_damage, 0);
  v_next_phase := case
    when v_next_hp = 0 then 4
    when v_next_hp * 3 <= v_run.max_boss_hp then 3
    when v_next_hp * 3 <= v_run.max_boss_hp * 2 then 2
    else 1
  end;
  v_finished := v_next_hp = 0;

  update public.coop_hunt_runs
  set boss_hp = v_next_hp,
      phase = v_next_phase,
      event_sequence = v_sequence,
      status = case when v_finished then 'defeated' else 'active' end,
      updated_at = now(),
      completed_at = case when v_finished then now() else null end
  where match_id = p_match_id;

  insert into public.coop_hunt_actions (
    match_id, player_id, action_id, sequence, action_type, damage, payload
  )
  values (
    p_match_id,
    v_user_id,
    v_action_id,
    v_sequence,
    v_action_type,
    v_applied_damage,
    jsonb_build_object(
      'timing', v_timing,
      'kind', case lower(coalesce(v_payload ->> 'kind', 'hit'))
        when 'arrow' then 'arrow' when 'sword' then 'sword' when 'fuda' then 'fuda'
        when 'parry' then 'parry' when 'reflect' then 'reflect' when 'kotodama' then 'kotodama'
        when 'down' then 'down' else 'hit' end
    )
  );

  update public.match_players
  set score = score + v_applied_damage,
      status = case when v_action_type = 'down' then 'finished' else 'playing' end,
      progress = case when v_action_type = 'down'
        then coalesce(progress, '{}'::jsonb) || '{"down":true}'::jsonb else progress end,
      last_seen_at = now(),
      finished_at = case when v_action_type = 'down' then coalesce(finished_at, now()) else finished_at end
  where match_id = p_match_id and player_id = v_user_id;

  if v_action_type = 'down' then
    select count(*) = 2 and bool_and(coalesce(mp.progress ->> 'down', 'false') = 'true')
    into v_failed
    from public.match_players mp
    where mp.match_id = p_match_id and mp.status <> 'left';
    if v_failed then
      update public.coop_hunt_runs
      set status = 'failed', updated_at = now(), completed_at = now()
      where match_id = p_match_id and status = 'active';
      update public.match_players
      set status = 'finished', finished_at = coalesce(finished_at, now()), last_seen_at = now()
      where match_id = p_match_id and status in ('playing', 'disconnected');
      update public.matches
      set status = 'finished', finished_at = coalesce(finished_at, now()), updated_at = now()
      where id = p_match_id and status = 'active';
    end if;
  end if;

  if v_finished then
    update public.match_players
    set status = 'finished',
        finished_at = coalesce(finished_at, now()),
        last_seen_at = now()
    where match_id = p_match_id and status in ('playing', 'disconnected');

    update public.matches
    set status = 'finished',
        finished_at = coalesce(finished_at, now()),
        updated_at = now()
    where id = p_match_id and status = 'active';
  end if;

  v_state := public.coop_hunt_build_state(p_match_id, v_user_id);
  return v_state || jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'action_id', v_action_id,
    'sequence', v_sequence,
    'damage', v_applied_damage,
    'cooldown_ms', v_cooldown_ms,
    'finished', v_finished or v_failed
  );
end;
$$;

-- Replace only the generic start RPC implementation. Its signature and all
-- non-coop behavior remain unchanged; coop runs are initialized after the
-- normal two-player room transition succeeds.
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

  if v_match.mode = 'coop_hunt' then
    perform public.coop_hunt_ensure_run(p_match_id);
  end if;

  return public.online_match_state(p_match_id);
end;
$$;

-- The generic progress RPC remains available to races and score challenges,
-- but co-op contribution/down state is writable only through the action RPC.
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
  if v_match.mode = 'coop_hunt' then
    raise exception 'Cooperative hunt progress requires the action RPC' using errcode = '42501';
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

create or replace function public.coop_hunt_close_terminal_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.mode = 'coop_hunt'
     and new.status in ('cancelled', 'expired')
     and old.status is distinct from new.status then
    update public.coop_hunt_runs
    set status = 'failed', updated_at = now(), completed_at = coalesce(completed_at, now())
    where match_id = new.id and status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists coop_hunt_terminal_match_trigger on public.matches;
create trigger coop_hunt_terminal_match_trigger
after update of status on public.matches
for each row execute function public.coop_hunt_close_terminal_run();

revoke all on function public.online_validate_mode(text) from public;
revoke all on function public.coop_hunt_ensure_run(uuid) from public;
revoke all on function public.coop_hunt_build_state(uuid, uuid) from public;
revoke all on function public.coop_hunt_state(uuid) from public;
revoke all on function public.coop_hunt_submit_action(uuid, text, text, jsonb) from public;
revoke all on function public.online_start_match(uuid) from public;
revoke all on function public.online_update_match_player(uuid, integer, integer, jsonb, boolean) from public;
revoke all on function public.coop_hunt_close_terminal_run() from public;

grant execute on function public.coop_hunt_state(uuid) to authenticated;
grant execute on function public.coop_hunt_submit_action(uuid, text, text, jsonb) to authenticated;
grant execute on function public.online_start_match(uuid) to authenticated;
grant execute on function public.online_update_match_player(uuid, integer, integer, jsonb, boolean) to authenticated;

commit;
