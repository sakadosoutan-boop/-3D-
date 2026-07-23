-- Qualify CTE columns that share names with RETURNS TABLE output parameters.
-- Safe to apply after 20260723_online_competition.sql; no rows are changed.

begin;

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
    select e.*, row_number() over (
      partition by e.player_id
      order by
        case when v_mode = 'quiz_ta' then coalesce(e.duration_ms, 2147483647) else 0 end asc,
        case when v_mode <> 'quiz_ta' then e.score else 0 end desc,
        e.created_at asc
    ) as player_position
    from eligible e
  ), ranked as (
    select b.*, rank() over (
      order by
        case when v_mode = 'quiz_ta' then coalesce(b.duration_ms, 2147483647) else 0 end asc,
        case when v_mode <> 'quiz_ta' then b.score else 0 end desc,
        b.created_at asc
    ) as board_rank
    from best_per_player b
    where b.player_position = 1
  )
  select ranked.board_rank::integer, ranked.player_id, ranked.display_name,
         ranked.score, ranked.duration_ms, ranked.created_at,
         ranked.player_id = v_user_id
  from ranked
  order by ranked.board_rank, ranked.created_at
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
    select e.*, row_number() over (
      partition by e.player_id
      order by
        case when v_mode = 'quiz_ta' then coalesce(e.duration_ms, 2147483647) else 0 end asc,
        case when v_mode <> 'quiz_ta' then e.score else 0 end desc,
        e.created_at asc
    ) as player_position
    from eligible e
  ), ranked as (
    select b.*, rank() over (
      order by
        case when v_mode = 'quiz_ta' then coalesce(b.duration_ms, 2147483647) else 0 end asc,
        case when v_mode <> 'quiz_ta' then b.score else 0 end desc,
        b.created_at asc
    ) as board_rank,
    count(*) over () as board_size
    from best_per_player b
    where b.player_position = 1
  )
  select ranked.board_rank::integer, ranked.board_size::integer, ranked.score,
         ranked.duration_ms, ranked.created_at
  from ranked
  where ranked.player_id = v_user_id;
end;
$$;

revoke all on function public.online_leaderboard(text, text, integer) from public;
revoke all on function public.online_my_rank(text, text) from public;
grant execute on function public.online_leaderboard(text, text, integer) to authenticated;
grant execute on function public.online_my_rank(text, text) to authenticated;

commit;
