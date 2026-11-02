do $$
declare original public.tkb_documents; checked public.tkb_documents; ack jsonb; order_ids jsonb; entry jsonb;
begin
 if has_function_privilege('anon','public.tkb_patch_working(jsonb,jsonb,jsonb,bigint,text)','execute') or has_function_privilege('authenticated','public.tkb_patch_working(jsonb,jsonb,jsonb,bigint,text)','execute') then raise exception 'PUBLIC_RPC_ACCESS';end if;
 if not has_function_privilege('service_role','public.tkb_patch_working(jsonb,jsonb,jsonb,bigint,text)','execute') then raise exception 'SERVER_RPC_ACCESS_MISSING';end if;
 perform pg_advisory_xact_lock(hashtextextended('timetables/working',0));
 select * into original from public.tkb_documents where collection='timetables' and id='working' for update;
 begin
  ack:=public.tkb_patch_working('{}'::jsonb,null,null,original.version,'rollback-only-test');
  select * into checked from public.tkb_documents where collection='timetables' and id='working';
  if checked.data is distinct from original.data or checked.version<>original.version+1 or (ack->>'version')::bigint<>checked.version then raise exception 'PATCH_DATA_MISMATCH';end if;
  select coalesce(jsonb_agg(e->>'id' order by n),'[]'::jsonb) into order_ids from jsonb_array_elements(coalesce(original.data->'changeHistory','[]'::jsonb)) with ordinality as x(e,n);
  entry:=jsonb_build_object('id','__rollback_history_test__','description','transaction-only verification');
  ack:=public.tkb_patch_working('{}'::jsonb,jsonb_build_object('__rollback_history_test__',entry),jsonb_build_array('__rollback_history_test__')||order_ids,checked.version,'rollback-only-test');
  select * into checked from public.tkb_documents where collection='timetables' and id='working';
  if checked.data->'changeHistory'->0 is distinct from entry or (checked.data->'changeHistory')-0 is distinct from coalesce(original.data->'changeHistory','[]'::jsonb) then raise exception 'HISTORY_MISMATCH';end if;
  raise exception 'Verified; rollback subtransaction now' using errcode='TST01';
 exception when sqlstate 'TST01' then null;
 end;
 select * into checked from public.tkb_documents where collection='timetables' and id='working';
 if checked.data is distinct from original.data or checked.version<>original.version then raise exception 'ROLLBACK_FAILED';end if;
end $$;
select 'Verified fast save + history + permissions; test writes rolled back' as result;
