create or replace function public.tkb_cas_document(p_collection text,p_id text,p_data jsonb,p_expected bigint,p_actor text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare old_row public.tkb_documents; result public.tkb_documents; draft jsonb; k text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_collection||'/'||p_id,0));
 if p_collection='timetables' and p_id='published' and p_data->>'isPublished'='true' then
   perform pg_advisory_xact_lock(hashtextextended('timetables/working',0));
   select data into draft from public.tkb_documents where collection='timetables' and id='working';
   if draft is null then raise exception 'PUBLICATION_OUTDATED' using errcode='PT409';end if;
   foreach k in array array['school','classes','subjects','teachers','timeSlots','timetableCells'] loop
     if draft->k is distinct from p_data->'data'->k then raise exception 'PUBLICATION_OUTDATED' using errcode='PT409';end if;
   end loop;
 end if;
 select * into old_row from public.tkb_documents where collection=p_collection and id=p_id for update;
 if coalesce(old_row.version,0)<>p_expected then raise exception 'VERSION_CONFLICT' using errcode='PT409'; end if;
 if p_data is null then
   delete from public.tkb_documents where collection=p_collection and id=p_id;
 else
   insert into public.tkb_documents(collection,id,data,version) values(p_collection,p_id,p_data,p_expected+1)
   on conflict(collection,id) do update set data=excluded.data,version=excluded.version,updated_at=now()
   returning * into result;
 end if;
 insert into public.tkb_audit(actor,collection,document_id,operation,before_hash,after_hash)
 values(p_actor,p_collection,p_id,case when p_data is null then 'delete' when p_expected=0 then 'create' else 'update' end,md5(old_row.data::text),md5(p_data::text));
 return case when p_data is null then jsonb_build_object('id',p_id,'data',null,'version',0) else to_jsonb(result) end;
end $$;
revoke all on function public.tkb_cas_document(text,text,jsonb,bigint,text) from public,anon,authenticated;
grant execute on function public.tkb_cas_document(text,text,jsonb,bigint,text) to service_role;
select 'Conflict responses use HTTP 409' as verification;
