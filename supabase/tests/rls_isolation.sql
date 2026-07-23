begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

select policies_are('public', 'agent_runs', array['members can view runs', 'members can create runs']);
select policies_are('public', 'run_spans', array['members can view spans']);
select policies_are('public', 'run_logs', array['members can view logs']);
select policies_are('public', 'investigation_notes', array['members can view own notes', 'members can create own notes', 'members can edit own notes']);
select policies_are('public', 'remediations', array['members can view remediations', 'members can create remediations', 'members can update own remediations']);

select function_privs_are(
  'public', 'create_demo_run', array['text'], 'anon', array[]::text[],
  'Anonymous users cannot generate workspace runs'
);
select function_privs_are(
  'public', 'get_healthy_baselines', array['uuid', 'integer', 'integer'], 'anon', array[]::text[],
  'Anonymous users cannot query workspace baselines'
);
select function_privs_are(
  'public', 'run_remediation', array['uuid', 'text'], 'anon', array[]::text[],
  'Anonymous users cannot execute remediations'
);
select function_privs_are(
  'public', 'create_demo_run', array['text'], 'authenticated', array['EXECUTE'],
  'Authenticated users can generate runs through the scoped RPC'
);
select function_privs_are(
  'public', 'get_healthy_baselines', array['uuid', 'integer', 'integer'], 'authenticated', array['EXECUTE'],
  'Authenticated users can query their scoped baseline'
);
select function_privs_are(
  'public', 'run_remediation', array['uuid', 'text'], 'authenticated', array['EXECUTE'],
  'Authenticated users can execute a scoped remediation'
);

select ok(
  position('public.is_workspace_member(public.run_workspace_id(run_id))' in pg_get_expr(pol.polqual, pol.polrelid)) > 0,
  'Note updates require current workspace membership'
)
from pg_policy pol
join pg_class cls on cls.oid = pol.polrelid
join pg_namespace nsp on nsp.oid = cls.relnamespace
where nsp.nspname = 'public'
  and cls.relname = 'investigation_notes'
  and pol.polname = 'members can edit own notes';

select * from finish();
rollback;