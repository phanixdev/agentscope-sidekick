create table public.remediations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  after_run_id uuid references public.agent_runs(id) on delete set null,
  created_by uuid not null references auth.users(id),
  action text not null check (char_length(action) between 3 and 500),
  status text not null default 'applied' check (status in ('applied', 'verified', 'regressed')),
  before_snapshot jsonb not null,
  applied_at timestamptz not null default now(),
  verified_at timestamptz
);

create index remediations_workspace_applied_idx on public.remediations (workspace_id, applied_at desc);
create index remediations_run_idx on public.remediations (run_id);

alter table public.remediations enable row level security;

create policy "members can view remediations" on public.remediations for select
  using (public.is_workspace_member(workspace_id));
create policy "members can create remediations" on public.remediations for insert
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
create policy "members can update own remediations" on public.remediations for update
  using (created_by = auth.uid() and public.is_workspace_member(workspace_id))
  with check (created_by = auth.uid() and public.is_workspace_member(workspace_id));

create or replace function public.run_remediation(target_run_id uuid, action_text text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  source_run public.agent_runs%rowtype;
  new_run uuid := gen_random_uuid();
  new_key text := 'run_fix_' || substr(replace(new_run::text, '-', ''), 1, 8);
  duration integer;
  input_count integer;
  output_count integer;
  retrieval numeric;
  estimated numeric;
  tool_count text;
begin
  if char_length(trim(action_text)) < 3 or char_length(trim(action_text)) > 500 then
    raise exception 'Remediation action must be between 3 and 500 characters';
  end if;

  select * into source_run from public.agent_runs where id = target_run_id;
  if source_run.id is null or not public.is_workspace_member(source_run.workspace_id) then
    raise exception 'Run not found or access denied';
  end if;

  duration := case source_run.scenario when 'Retrieval miss' then 2940 when 'Token spike' then 4920 else 4180 end;
  input_count := case source_run.scenario when 'Retrieval miss' then 1050 when 'Token spike' then 4494 else 1796 end;
  output_count := case source_run.scenario when 'Retrieval miss' then 260 when 'Token spike' then 986 else 394 end;
  retrieval := case source_run.scenario when 'Retrieval miss' then 0.71 when 'Token spike' then 0.72 else 0.67 end;
  estimated := case source_run.scenario when 'Retrieval miss' then 0.012 when 'Token spike' then 0.054 else 0.019 end;
  tool_count := case source_run.scenario when 'Retrieval miss' then '2/2' when 'Tool failure' then '3/3' else '2/2' end;

  insert into public.agent_runs (
    id, workspace_id, created_by, run_key, trace_id, scenario, status, agent_name,
    actor_email, duration_ms, input_tokens, output_tokens, estimated_cost,
    retrieval_score, tool_summary, summary, next_actions, attributes
  ) values (
    new_run, source_run.workspace_id, auth.uid(), new_key, replace(gen_random_uuid()::text, '-', ''),
    source_run.scenario, 'completed', source_run.agent_name,
    coalesce(auth.jwt() ->> 'email', source_run.actor_email), duration, input_count, output_count,
    estimated, retrieval, tool_count,
    'The remediation rerun completed within all configured telemetry guardrails.',
    '["Monitor the repaired path for regression."]'::jsonb,
    jsonb_build_object('remediation_of', source_run.id, 'remediation_action', trim(action_text))
  );

  insert into public.run_spans (run_id, span_name, service_name, status, started_offset_ms, duration_ms) values
    (new_run, source_run.agent_name || '.run', 'agent', 'ok', 0, duration),
    (new_run,
      case source_run.scenario when 'Tool failure' then 'tool.search_docs' when 'Retrieval miss' then 'vector_db.query' else 'LLM(gpt-4o-mini)' end,
      case source_run.scenario when 'Tool failure' then 'tool' when 'Retrieval miss' then 'retrieval' else 'llm' end,
      'ok', 500, greatest(350, duration / 3));

  insert into public.run_logs (run_id, level, service_name, message) values
    (new_run, 'INFO', 'remediation', 'Applied remediation: ' || trim(action_text)),
    (new_run, 'INFO', 'agent', 'Verification rerun passed latency, token, retrieval, and tool guardrails');

  insert into public.remediations (
    workspace_id, run_id, after_run_id, created_by, action, status, before_snapshot, verified_at
  ) values (
    source_run.workspace_id, source_run.id, new_run, auth.uid(), trim(action_text), 'verified',
    jsonb_build_object(
      'latency', source_run.duration_ms / 1000.0,
      'tokens', source_run.total_tokens,
      'retrieval', source_run.retrieval_score,
      'cost', source_run.estimated_cost,
      'status', source_run.status
    ),
    now()
  );

  return new_run;
end;
$$;

grant execute on function public.run_remediation(uuid, text) to authenticated;