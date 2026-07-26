-- 御前五番勝負を既存の2人対戦・共有順位基盤へ追加する。
-- 既存4種目の行やRPC契約は変更せず、gozen5 だけ得点上限と単調進捗を強制する。

alter table public.scores drop constraint if exists scores_mode_check;
alter table public.scores
  add constraint scores_mode_check
  check (mode in ('gozen5', 'quiz', 'quiz_ta', 'kemari', 'koh_awase'));

alter table public.matches drop constraint if exists matches_mode_check;
alter table public.matches
  add constraint matches_mode_check
  check (mode in ('gozen5', 'quiz', 'quiz_ta', 'kemari', 'koh_awase'));

alter table public.scores drop constraint if exists scores_gozen5_range_check;
alter table public.scores
  add constraint scores_gozen5_range_check
  check (mode <> 'gozen5' or score between 0 and 5000);

create or replace function public.online_validate_mode(p_mode text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_mode text := lower(btrim(coalesce(p_mode, '')));
begin
  if v_mode not in ('gozen5', 'quiz', 'quiz_ta', 'kemari', 'koh_awase') then
    raise exception 'Unsupported mode: %', coalesce(p_mode, '') using errcode = '22023';
  end if;
  return v_mode;
end;
$$;

create or replace function public.online_guard_gozen5_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mode text;
  v_old_bout integer := coalesce((old.progress ->> 'bout')::integer, 0);
  v_new_bout integer := coalesce((new.progress ->> 'bout')::integer, 0);
  v_score_count integer;
  v_score_total integer;
  v_scores_in_range boolean;
begin
  select m.mode into v_mode from public.matches m where m.id = new.match_id;
  if v_mode <> 'gozen5' then
    return new;
  end if;
  if new.score < old.score then
    raise exception 'Gozen five score cannot decrease' using errcode = '22023';
  end if;
  if new.score > 5000 then
    raise exception 'Gozen five score exceeds 5000' using errcode = '22023';
  end if;
  if v_new_bout < v_old_bout then
    raise exception 'Gozen five progress cannot move backward' using errcode = '22023';
  end if;
  if new.status = 'finished' then
    if jsonb_typeof(new.progress -> 'scores') <> 'object'
      or not ((new.progress -> 'scores') ?& array['quiz', 'kai', 'koh', 'waka', 'kemari'])
      or jsonb_object_length(new.progress -> 'scores') <> 5 then
      raise exception 'Gozen five result requires all five bout scores' using errcode = '22023';
    end if;
    select count(*), sum(value::integer), bool_and(value::integer between 0 and 1000)
      into v_score_count, v_score_total, v_scores_in_range
      from jsonb_each_text(new.progress -> 'scores');
    if v_score_count <> 5 or not coalesce(v_scores_in_range, false) or v_score_total <> new.score then
      raise exception 'Gozen five bout scores do not match total' using errcode = '22023';
    end if;
    if coalesce((new.progress ->> 'progress')::integer, 0) <> 5
      or coalesce((new.progress ->> 'complete')::boolean, false) is not true then
      raise exception 'Gozen five result is not complete' using errcode = '22023';
    end if;
  end if;
  if old.status = 'finished' and (new.score <> old.score or new.progress <> old.progress) then
    raise exception 'Finished gozen five result is frozen' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists online_guard_gozen5_progress_trigger on public.match_players;
create trigger online_guard_gozen5_progress_trigger
before update on public.match_players
for each row execute function public.online_guard_gozen5_progress();

revoke all on function public.online_validate_mode(text) from public;
revoke all on function public.online_guard_gozen5_progress() from public;
