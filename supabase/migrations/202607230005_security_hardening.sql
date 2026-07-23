-- Make callable privileges match the product's authenticated-only contract.
revoke execute on function public.create_demo_run(text) from public, anon;
revoke execute on function public.get_healthy_baselines(uuid, integer, integer) from public, anon;
revoke execute on function public.run_remediation(uuid, text) from public, anon;

grant execute on function public.create_demo_run(text) to authenticated;
grant execute on function public.get_healthy_baselines(uuid, integer, integer) to authenticated;
grant execute on function public.run_remediation(uuid, text) to authenticated;

-- An author who is later removed from a workspace must not retain note access.
drop policy if exists "members can edit own notes" on public.investigation_notes;
create policy "members can edit own notes" on public.investigation_notes for update
  using (
    user_id = auth.uid()
    and public.is_workspace_member(public.run_workspace_id(run_id))
  )
  with check (
    user_id = auth.uid()
    and public.is_workspace_member(public.run_workspace_id(run_id))
  );