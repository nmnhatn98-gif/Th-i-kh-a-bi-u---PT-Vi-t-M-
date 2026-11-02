-- Additive optimization: existing data and the old CAS function stay unchanged.
create or replace function public.tkb_patch_working(p_patch jsonb,p_history_changes jsonb,p_history_order jsonb,p_expected bigint,p_actor text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare old_row public.tkb_documents; draft jsonb; history_map jsonb; new_history jsonb;
begin
 if jsonb_typeof(p_patch)<>'object' then raise exception 'INVALID_PATCH' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('timetables/working',0));
 select * into old_row from public.tkb_documents where collection='timetables' and id='working' for update;
 if old_row.data is null or old_row.version<>p_expected then raise exception 'VERSION_CONFLICT' using errcode='PT409';end if;
 draft:=old_row.data||p_patch;
 if p_history_order is not null then
  if jsonb_typeof(p_history_order)<>'array' or jsonb_typeof(p_history_changes)<>'object' then raise exception 'INVALID_HISTORY' using errcode='22023';end if;
  select coalesce(jsonb_object_agg(e->>'id',e),'{}'::jsonb) into history_map from jsonb_array_elements(coalesce(old_row.data->'changeHistory','[]'::jsonb)) e;
  history_map:=history_map||p_history_changes;
  if exists(select 1 from jsonb_array_elements_text(p_history_order) k where not history_map?k) then raise exception 'MISSING_HISTORY' using errcode='22023';end if;
  select coalesce(jsonb_agg(history_map->k order by n),'[]'::jsonb) into new_history from jsonb_array_elements_text(p_history_order) with ordinality as x(k,n);
  draft:=jsonb_set(draft,'{changeHistory}',new_history,true);
 end if;
 update public.tkb_documents set data=draft,version=p_expected+1,updated_at=now() where collection='timetables' and id='working';
 insert into public.tkb_audit(actor,collection,document_id,operation,before_hash,after_hash) values(p_actor,'timetables','working','update',md5(old_row.data::text),md5(draft::text));
 return jsonb_build_object('id','working','version',p_expected+1);
end $$;
revoke all on function public.tkb_patch_working(jsonb,jsonb,jsonb,bigint,text) from public,anon,authenticated;
grant execute on function public.tkb_patch_working(jsonb,jsonb,jsonb,bigint,text) to service_role;
notify pgrst,'reload schema';
select 'Fast working save installed; timetable data unchanged' as result;
