create extension if not exists pgcrypto;

create type public.workspace_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.run_status as enum ('completed', 'failed', 'running');
create type public.alert_severity as enum ('critical', 'warning', 'info');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  environment text not null default 'Production',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  run_key text not null,
  trace_id text not null,
  scenario text not null,
  status public.run_status not null,
  agent_name text not null,
  actor_email text not null,
  started_at timestamptz not null default now(),
  duration_ms integer not null check (duration_ms >= 0),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  total_tokens integer generated always as (input_tokens + output_tokens) stored,
  estimated_cost numeric(12, 6) not null default 0,
  retrieval_score numeric(5, 4) not null default 0 check (retrieval_score between 0 and 1),
  tool_summary text not null default '0/0',
  summary text not null,
  next_actions jsonb not null default '[]'::jsonb,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, run_key),
  unique (workspace_id, trace_id)
);

create table public.run_spans (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  parent_span_id uuid references public.run_spans(id) on delete cascade,
  span_name text not null,
  service_name text not null,
  status text not null check (status in ('ok', 'warn', 'error')),
  started_offset_ms integer not null default 0 check (started_offset_ms >= 0),
  duration_ms integer not null check (duration_ms >= 0),
  attributes jsonb not null default '{}'::jsonb
);

create table public.run_logs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  level text not null check (level in ('DEBUG', 'INFO', 'WARN', 'ERROR')),
  service_name text not null,
  message text not null,
  attributes jsonb not null default '{}'::jsonb
);

create table public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  metric text not null,
  threshold text not null,
  severity public.alert_severity not null,
  enabled boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.investigation_notes (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, user_id)
);

create index agent_runs_workspace_started_idx on public.agent_runs (workspace_id, started_at desc);
create index agent_runs_workspace_status_idx on public.agent_runs (workspace_id, status);
create index agent_runs_trace_idx on public.agent_runs (trace_id);
create index run_spans_run_start_idx on public.run_spans (run_id, started_offset_ms);
create index run_logs_run_occurred_idx on public.run_logs (run_id, occurred_at);
create index alert_rules_workspace_enabled_idx on public.alert_rules (workspace_id, enabled);

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id and user_id = auth.uid()
  );
$$;

create or replace function public.run_workspace_id(target_run_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from public.agent_runs where id = target_run_id;
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.agent_runs enable row level security;
alter table public.run_spans enable row level security;
alter table public.run_logs enable row level security;
alter table public.alert_rules enable row level security;
alter table public.investigation_notes enable row level security;

create policy "profiles are visible to owner" on public.profiles for select using (id = auth.uid());
create policy "profiles are editable by owner" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "members can view workspaces" on public.workspaces for select using (public.is_workspace_member(id));
create policy "members can view memberships" on public.workspace_members for select using (public.is_workspace_member(workspace_id));
create policy "members can view runs" on public.agent_runs for select using (public.is_workspace_member(workspace_id));
create policy "members can create runs" on public.agent_runs for insert with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
create policy "members can view spans" on public.run_spans for select using (public.is_workspace_member(public.run_workspace_id(run_id)));
create policy "members can view logs" on public.run_logs for select using (public.is_workspace_member(public.run_workspace_id(run_id)));
create policy "members can view alerts" on public.alert_rules for select using (public.is_workspace_member(workspace_id));
create policy "admins can edit alerts" on public.alert_rules for update
  using (exists (select 1 from public.workspace_members where workspace_id = alert_rules.workspace_id and user_id = auth.uid() and role in ('owner', 'admin')))
  with check (exists (select 1 from public.workspace_members where workspace_id = alert_rules.workspace_id and user_id = auth.uid() and role in ('owner', 'admin')));
create policy "members can view own notes" on public.investigation_notes for select
  using (user_id = auth.uid() and public.is_workspace_member(public.run_workspace_id(run_id)));
create policy "members can create own notes" on public.investigation_notes for insert
  with check (user_id = auth.uid() and public.is_workspace_member(public.run_workspace_id(run_id)));
create policy "members can edit own notes" on public.investigation_notes for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.seed_workspace(target_user uuid, target_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace uuid;
  tool_run uuid;
  retrieval_run uuid;
  token_run uuid;
begin
  insert into public.workspaces (name, created_by) values ('My AI Workspace', target_user) returning id into workspace;
  insert into public.workspace_members (workspace_id, user_id, role) values (workspace, target_user, 'owner');

  insert into public.agent_runs (workspace_id, created_by, run_key, trace_id, scenario, status, agent_name, actor_email, started_at, duration_ms, input_tokens, output_tokens, estimated_cost, retrieval_score, tool_summary, summary, next_actions)
  values (workspace, target_user, 'run_7f3a1c9d', replace(gen_random_uuid()::text, '-', ''), 'Tool failure', 'failed', 'ResearchAgent', target_email, now() - interval '3 minutes', 12480, 1921, 420, 0.021, 0.62, '2/3', 'The search_docs tool returned HTTP 500 and caused the run to fail.', '["Check upstream availability for document search.","Add retry and circuit-breaker telemetry.","Alert on tool error rate above 5%."]')
  returning id into tool_run;

  insert into public.agent_runs (workspace_id, created_by, run_key, trace_id, scenario, status, agent_name, actor_email, started_at, duration_ms, input_tokens, output_tokens, estimated_cost, retrieval_score, tool_summary, summary, next_actions)
  values (workspace, target_user, 'run_2c8b4e7a', replace(gen_random_uuid()::text, '-', ''), 'Retrieval miss', 'completed', 'AnalystAgent', target_email, now() - interval '29 minutes', 3210, 884, 319, 0.011, 0.18, '1/2', 'The run completed, but retrieval confidence and source diversity were too low.', '["Tune vector filters and chunking.","Require minimum source diversity.","Dashboard retrieval score by agent."]')
  returning id into retrieval_run;

  insert into public.agent_runs (workspace_id, created_by, run_key, trace_id, scenario, status, agent_name, actor_email, started_at, duration_ms, input_tokens, output_tokens, estimated_cost, retrieval_score, tool_summary, summary, next_actions)
  values (workspace, target_user, 'run_9d7e6b11', replace(gen_random_uuid()::text, '-', ''), 'Token spike', 'completed', 'PlannerAgent', target_email, now() - interval '56 minutes', 6740, 17184, 1458, 0.182, 0.74, '2/2', 'Context expansion pushed token usage to 3.4x the normal baseline.', '["Add token budget guardrails.","Summarize context before planner prompts.","Alert above 2x token baseline."]')
  returning id into token_run;

  insert into public.run_spans (run_id, span_name, service_name, status, started_offset_ms, duration_ms) values
    (tool_run, 'ResearchAgent.run', 'agent', 'error', 0, 12480),
    (tool_run, 'LLM(gpt-4o-mini)', 'llm', 'ok', 600, 9630),
    (tool_run, 'tool.search_docs', 'tool', 'error', 1200, 2410),
    (tool_run, 'vector_db.query', 'retrieval', 'ok', 3400, 660),
    (retrieval_run, 'AnalystAgent.run', 'agent', 'warn', 0, 3210),
    (retrieval_run, 'vector_db.query', 'retrieval', 'warn', 400, 420),
    (retrieval_run, 'LLM(gpt-4o-mini)', 'llm', 'ok', 900, 1820),
    (token_run, 'PlannerAgent.run', 'agent', 'warn', 0, 6740),
    (token_run, 'retrieval.expand_context', 'retrieval', 'ok', 600, 1740),
    (token_run, 'LLM(gpt-4o-mini)', 'llm', 'warn', 2400, 3820);

  insert into public.run_logs (run_id, occurred_at, level, service_name, message) values
    (tool_run, now() - interval '3 minutes', 'ERROR', 'tool.search_docs', 'HTTP 500 Internal Server Error: upstream unavailable'),
    (tool_run, now() - interval '3 minutes 1 second', 'WARN', 'ResearchAgent', 'Tool call failed after retry budget was exhausted'),
    (retrieval_run, now() - interval '29 minutes', 'WARN', 'retrieval', 'Low retrieval score: mean=0.18, results_used=1/5'),
    (token_run, now() - interval '56 minutes', 'WARN', 'llm', 'Token usage exceeded p95 baseline by 3.4x');

  insert into public.alert_rules (workspace_id, name, metric, threshold, severity, created_by) values
    (workspace, 'Tool error rate', 'agentscope.tool.calls', '> 5%', 'critical', target_user),
    (workspace, 'Token budget exceeded', 'agentscope.agent.tokens_per_run.max', '> 12k', 'warning', target_user),
    (workspace, 'Retrieval quality', 'agentscope.retrieval.score.min', '< 0.30', 'warning', target_user),
    (workspace, 'Agent run latency', 'agentscope.agent.duration.max', '> 10s', 'critical', target_user);
  return workspace;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  perform public.seed_workspace(new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.create_demo_run(scenario_key text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace uuid;
  new_run uuid;
  run_key text := 'run_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  scenario_name text;
  run_status public.run_status;
  duration integer;
  input_count integer;
  output_count integer;
  retrieval numeric;
begin
  select workspace_id into workspace from public.workspace_members where user_id = auth.uid() order by created_at limit 1;
  if workspace is null then raise exception 'No workspace found'; end if;

  scenario_name := case scenario_key when 'retrieval_miss' then 'Retrieval miss' when 'token_spike' then 'Token spike' else 'Tool failure' end;
  run_status := case when scenario_key = 'tool_failure' then 'failed'::public.run_status else 'completed'::public.run_status end;
  duration := case scenario_key when 'retrieval_miss' then 3210 when 'token_spike' then 6740 else 12480 end;
  input_count := case scenario_key when 'retrieval_miss' then 884 when 'token_spike' then 17184 else 1921 end;
  output_count := case scenario_key when 'retrieval_miss' then 319 when 'token_spike' then 1458 else 420 end;
  retrieval := case scenario_key when 'retrieval_miss' then 0.18 when 'token_spike' then 0.74 else 0.62 end;

  insert into public.agent_runs (workspace_id, created_by, run_key, trace_id, scenario, status, agent_name, actor_email, duration_ms, input_tokens, output_tokens, estimated_cost, retrieval_score, tool_summary, summary, next_actions)
  values (workspace, auth.uid(), run_key, replace(gen_random_uuid()::text, '-', ''), scenario_name, run_status,
    case scenario_key when 'retrieval_miss' then 'AnalystAgent' when 'token_spike' then 'PlannerAgent' else 'ResearchAgent' end,
    coalesce(auth.jwt() ->> 'email', 'user@example.com'), duration, input_count, output_count,
    case scenario_key when 'retrieval_miss' then 0.011 when 'token_spike' then 0.182 else 0.021 end,
    retrieval, case when scenario_key = 'retrieval_miss' then '1/2' when scenario_key = 'tool_failure' then '2/3' else '2/2' end,
    case scenario_key when 'retrieval_miss' then 'Retrieval confidence and source diversity were too low.' when 'token_spike' then 'Context expansion pushed token usage above the normal baseline.' else 'The search_docs tool returned an upstream error.' end,
    case scenario_key when 'retrieval_miss' then '["Tune vector filters.","Require source diversity."]'::jsonb when 'token_spike' then '["Add token guardrails.","Summarize context earlier."]'::jsonb else '["Inspect upstream health.","Add retry telemetry."]'::jsonb end)
  returning id into new_run;

  insert into public.run_spans (run_id, span_name, service_name, status, started_offset_ms, duration_ms) values
    (new_run, case scenario_key when 'retrieval_miss' then 'AnalystAgent.run' when 'token_spike' then 'PlannerAgent.run' else 'ResearchAgent.run' end, 'agent', case when run_status = 'failed' then 'error' else 'warn' end, 0, duration),
    (new_run, case when scenario_key = 'tool_failure' then 'tool.search_docs' when scenario_key = 'retrieval_miss' then 'vector_db.query' else 'LLM(gpt-4o-mini)' end, case when scenario_key = 'tool_failure' then 'tool' when scenario_key = 'retrieval_miss' then 'retrieval' else 'llm' end, case when scenario_key = 'tool_failure' then 'error' else 'warn' end, 600, greatest(420, duration / 3));

  insert into public.run_logs (run_id, level, service_name, message) values
    (new_run, case when scenario_key = 'tool_failure' then 'ERROR' else 'WARN' end, case when scenario_key = 'tool_failure' then 'tool.search_docs' when scenario_key = 'retrieval_miss' then 'retrieval' else 'llm' end, case when scenario_key = 'tool_failure' then 'HTTP 500 from upstream document search' when scenario_key = 'retrieval_miss' then 'Retrieval score below quality threshold' else 'Token usage exceeded p95 baseline' end);
  return new_run;
end;
$$;

grant execute on function public.create_demo_run(text) to authenticated;
revoke execute on function public.seed_workspace(uuid, text) from public, anon, authenticated;

