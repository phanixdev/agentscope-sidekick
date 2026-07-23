-- Fix trace ID generation for hosted Supabase projects where gen_random_bytes is unavailable.

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

