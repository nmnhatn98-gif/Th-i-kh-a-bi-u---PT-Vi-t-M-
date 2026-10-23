-- Kiểm tra thật trong transaction rồi ROLLBACK: không để lại dữ liệu kiểm thử.
begin;
do $check$
declare saved jsonb; conflict_seen boolean:=false;
begin
 if not exists(select 1 from pg_class where oid='public.tkb_documents'::regclass and relrowsecurity) then raise exception 'RLS_NOT_ENABLED';end if;
 if has_table_privilege('anon','public.tkb_documents','select') or has_table_privilege('authenticated','public.tkb_documents','insert') then raise exception 'BROWSER_ACCESS_NOT_BLOCKED';end if;
 if has_function_privilege('anon','public.tkb_cas_document(text,text,jsonb,bigint,text)','execute') then raise exception 'RPC_PUBLIC';end if;
 saved:=public.tkb_cas_document('requests','__tkb_trial_check__','{"status":"PENDING","teacherEmail":"trial@example.invalid"}'::jsonb,0,'trial@example.invalid');
 if (saved->>'version')::integer<>1 then raise exception 'CREATE_VERSION_FAILED';end if;
 begin
  perform public.tkb_cas_document('requests','__tkb_trial_check__','{"status":"PENDING"}'::jsonb,0,'trial@example.invalid');
 exception when sqlstate 'PT409' then conflict_seen:=true;
 end;
 if not conflict_seen then raise exception 'CONFLICT_NOT_DETECTED';end if;
 saved:=public.tkb_cas_document('requests','__tkb_trial_check__','{"status":"PENDING","note":"edited"}'::jsonb,1,'trial@example.invalid');
 if (saved->>'version')::integer<>2 then raise exception 'UPDATE_VERSION_FAILED';end if;
 if (select count(*) from public.tkb_audit where document_id='__tkb_trial_check__')<>2 then raise exception 'AUDIT_FAILED';end if;
end $check$;
rollback;
select 'PASS: RLS, grants, create/update, conflict and audit; test data rolled back' as verification;

