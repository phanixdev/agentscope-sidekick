-- Tenant-scoped healthy baselines. RLS remains authoritative because this
-- function executes with the caller's permissions.

create or replace function public.get_healthy_baselines(
  target_workspace_id uuid,
  lookback_hours integer default 24,
  required_samples integer default 5
)
returns table (
  scenario text,
  sample_size bigint,
  latency numeric,
  tokens numeric,
  retrieval numeric,
  cost numeric,
  tool_errors bigint,
  window_hours integer,
  computed_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with healthy_runs as (
    select run.*
    from public.agent_runs run
    where run.workspace_id = target_workspace_id
      and public.is_workspace_member(run.workspace_id)
      and run.status = 'completed'
      and run.started_at >= now() - make_interval(hours => greatest(1, least(lookback_hours, 720)))
      and run.total_tokens <= 12000
      and run.retrieval_score >= 0.30
      and not exists (
        select 1
        from public.run_spans span
        where span.run_id = run.id and span.status = 'error'
      )
  )
  select
    healthy_runs.scenario,
    count(*) as sample_size,
    round(avg(healthy_runs.duration_ms) / 1000.0, 3) as latency,
    round(avg(healthy_runs.total_tokens), 0) as tokens,
    round(avg(healthy_runs.retrieval_score), 4) as retrieval,
    round(avg(healthy_runs.estimated_cost), 6) as cost,
    0::bigint as tool_errors,
    greatest(1, least(lookback_hours, 720)) as window_hours,
    now() as computed_at
  from healthy_runs
  group by healthy_runs.scenario
  having count(*) >= greatest(1, required_samples);
$$;

grant execute on function public.get_healthy_baselines(uuid, integer, integer) to authenticated;