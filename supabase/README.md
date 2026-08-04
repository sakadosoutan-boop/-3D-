# Supabase: online competition

This directory contains the server-side contract for the shared leaderboard and
two-player rooms. It is deliberately separate from the static game build: the
browser gets only a Supabase project URL and publishable/anon key, never a
`service_role` key.

## One-time project setup

1. Create a Supabase project, then enable **Anonymous sign-ins** in
   `Authentication > Providers > Anonymous`.
2. Enable CAPTCHA or Turnstile and configure Auth rate limits before opening
   the game to the public. Anonymous accounts are still authenticated users,
   so this is the first abuse-control layer.
3. Run `migrations/20260723_online_competition.sql`, then
   `migrations/20260724_fix_online_ranking.sql` and
   `migrations/20260724_gozen_five.sql`, then
   `migrations/20260803_coop_hunt.sql` in the SQL Editor, or apply them in
   order with the Supabase CLI.
4. Put only the project URL and the publishable/anon key in the game's public
   deployment configuration. Do not commit a service-role key to this
   repository or place it in the HTML.

The current single-file client reads the public connection values before its
embedded application scripts run:

```html
<script>
window.SHINDEN_ONLINE_CONFIG = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  anonKey: "YOUR_PUBLISHABLE_OR_ANON_KEY"
};
</script>
```

For local QA, the same two public values can be supplied with
`ONLINE_COMPETITION.configure({ url, anonKey })`; they are then stored only in
that browser profile. If neither form is present, the game shows the online
entry as unavailable while every offline mode and local record continues to
work. The migration alone does not activate the public site: both the database
setup and these two public connection values are required.

The migration enables RLS on every table and deliberately creates no table
policies. Clients must call RPC endpoints as an authenticated anonymous user.
This means a player cannot list, insert, edit, or delete `profiles`, `scores`,
`matches`, or `match_players` with the Data API.

## Client session flow

1. On first use, sign in anonymously with Supabase Auth and persist the normal
   user session/refresh token in browser storage.
2. Ask for a 2-12 character display name, then call `online_set_profile`.
3. Use the access token with `Authorization: Bearer <access_token>` and the
   publishable/anon key with `apikey: <publishable_key>` for every RPC request.
4. Refresh the session before it expires. Treat `401`/`403` as a request to
   reauthenticate, not as a reason to retry writes blindly.

For a raw REST client, RPC calls are made to:

```text
POST https://<project-ref>.supabase.co/rest/v1/rpc/<rpc_name>
apikey: <publishable-or-anon-key>
Authorization: Bearer <anonymous-user-access-token>
Content-Type: application/json
```

## RPC contract

All listed functions are granted only to the `authenticated` role. A newly
signed-in anonymous user has that role.

| RPC | Input | Result and rules |
| --- | --- | --- |
| `online_set_profile` | `p_display_name` | Creates or updates the caller profile. Names are trimmed, 2-12 visible characters. |
| `online_submit_score` | `p_mode`, `p_score`, `p_duration_ms`, `p_metadata` | Adds one bounded score. Modes: `gozen5`, `quiz`, `quiz_ta`, `kemari`, `koh_awase`. Scores are `0..100000`; `gozen5` is additionally limited to `0..5000`. Duration is at most 30 minutes. Time attack needs a duration of at least one second. Each player is limited to 20 submissions per 10 minutes. |
| `online_leaderboard` | `p_mode`, `p_period`, `p_limit` | Returns top 1-100. Period is `daily`, `weekly`, or `all_time`. One best score per player is used; `quiz_ta` sorts by shortest duration, all other modes by highest score. |
| `online_my_rank` | `p_mode`, `p_period` | Returns the caller's rank, total ranked players, and best record for that period. Call alongside `online_leaderboard` so the player's rank remains visible even outside the top list. |
| `online_create_match` | `p_mode`, `p_expires_in_seconds`, `p_settings` | Creates a waiting two-player room. Expiry is clamped to 60-1800 seconds. The server generates both the six-character room code and the deterministic numeric seed. |
| `online_join_match` | `p_room_code` | Joins one waiting room as its guest. A room has one host and one current guest. |
| `online_start_match` | `p_match_id` | Starts the room. Only its host may call it, and exactly two waiting players are required. Active rooms have at least 20 minutes before expiry. |
| `online_match_state` | `p_match_id` | Returns a room only to a participant, including opponent progress. Calling it also acts as a heartbeat and reconnects a stale caller. Poll every 1-2 seconds while a room is open. |
| `online_update_match_player` | `p_match_id`, `p_score`, `p_duration_ms`, `p_progress`, `p_finished` | Updates only the caller's own active-match row. Progress must be a JSON object no larger than 4KB. When both players finish, the room is marked finished. |
| `online_leave_match` | `p_match_id` | Marks the caller as left. A host leaving while waiting cancels the room. |
| `coop_hunt_state` | `p_match_id` | Participant-only reconnect snapshot with shared boss HP/phase, event sequence, both contributions/down states, and the latest 20 accepted actions. |
| `coop_hunt_submit_action` | `p_match_id`, `p_action_id`, `p_action_type`, `p_payload` | Accepts `attack`, `focus`, `guard`, or `down` during an active co-op room. Damage and cooldowns are server-owned; `p_action_id` makes retries idempotent. |

`online_expire_stale_matches` is intentionally not callable by the browser.
Every room RPC invokes it first. A player that misses heartbeats for 90 seconds
is marked `disconnected`; rooms that pass `expires_at` become `expired`.
For larger traffic, schedule this internal function every minute with Supabase
Cron using a privileged database job.

## Game integration notes

Use the server-issued `seed` to build the same question order, item order, or
challenge layout for host and guest. Do not accept a seed sent by a player.
Send compact progress such as `{ "answered": 4, "correct": 3 }`; do not send
the full question bank, personal data, or arbitrary client logs.

Submit the final result through both `online_update_match_player(...,
true)` and `online_submit_score(...)` when the mode should contribute to the
shared leaderboard. The server validates identity, room membership, score and
time bounds, but a static client cannot fully prove gameplay. Treat rankings as
friendly competition; stronger anti-cheat needs an authoritative game server or
server-verifiable event log.

For `gozen5`, the migration also rejects decreasing bout progress or score,
limits each bout to 1000 and the total to 5000, verifies that all five bout
scores add up to the submitted total, and freezes a player's completed result.
The five sub-seeds are derived in the client from the server-issued room seed
and fixed discipline salts; players never choose the room seed.

For `coop_hunt`, do not send boss HP or client-calculated damage. The server
locks one shared run, calculates bounded damage from the accepted action class,
and assigns a monotonically increasing event sequence. Movement, projectiles,
and boss AI stay local; only shared HP and action results cross the network.
One downed player may spectate while the other continues. Two `down` states
finish the run as failed.

## Operational checks

- Verify anonymous sign-in works from the deployed GitHub Pages origin.
- Verify unauthenticated REST calls fail and direct table reads/writes return
  RLS permission errors.
- Create a room in one browser profile, join from a second profile, start as
  host, and verify both progress records update through `online_match_state`.
- Submit more than 20 records in 10 minutes and confirm the 21st is rejected.
- Confirm daily/weekly/all-time ranking order and an out-of-top-list player's
  `online_my_rank` result.

Useful Supabase references: [anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous), [RPC](https://supabase.com/docs/reference/javascript/rpc), and [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).
