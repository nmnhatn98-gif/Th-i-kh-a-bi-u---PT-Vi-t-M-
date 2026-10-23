-- Chạy một lần trong SQL Editor của dự án Supabase THỬ NGHIỆM.
-- Không chứa tài khoản, mật khẩu hay dữ liệu trường thật.
begin;
create table if not exists public.tkb_documents (
 collection text not null check(collection in ('users','timetables','requests','availabilities')),
 id text not null check(length(id) between 1 and 180),
 data jsonb not null check(jsonb_typeof(data)='object'),
 version bigint not null default 1,
 updated_at timestamptz not null default now(),
 primary key(collection,id)
);
create table if not exists public.tkb_audit (
 id bigint generated always as identity primary key,
 actor text not null, collection text not null, document_id text not null,
 operation text not null, before_hash text, after_hash text, created_at timestamptz not null default now()
);
alter table public.tkb_documents enable row level security;
alter table public.tkb_audit enable row level security;
revoke all on public.tkb_documents, public.tkb_audit from public, anon, authenticated;
grant select,insert,update,delete on public.tkb_documents to service_role;
grant select,insert on public.tkb_audit to service_role;
revoke all on sequence public.tkb_audit_id_seq from public,anon,authenticated;
grant usage,select on sequence public.tkb_audit_id_seq to service_role;

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

create or replace function public.tkb_import_documents(p_records jsonb,p_actor text)
returns integer language plpgsql security invoker set search_path=public as $$
declare item jsonb; amount integer:=0;
begin
 perform pg_advisory_xact_lock(hashtextextended('tkb-import',0));
 lock table public.tkb_documents in exclusive mode;
 if exists(select 1 from public.tkb_documents where collection<>'users' or id<>p_actor) then
  raise exception 'IMPORT_REQUIRES_EMPTY_DATABASE';
 end if;
 for item in select * from jsonb_array_elements(p_records) loop
   if exists(select 1 from public.tkb_documents where collection=item->>'collection' and id=item->>'id') then
     if item->>'collection'<>'users' or item->>'id'<>p_actor then raise exception 'IMPORT_TARGET_EXISTS';end if;
   end if;
   insert into public.tkb_documents(collection,id,data) values(item->>'collection',item->>'id',item->'data')
   on conflict(collection,id) do update set data=excluded.data,version=tkb_documents.version+1,updated_at=now();
   amount:=amount+1;
 end loop;
 insert into public.tkb_audit(actor,collection,document_id,operation) values(p_actor,'migration','all','import');
 return amount;
end $$;
revoke all on function public.tkb_import_documents(jsonb,text) from public,anon,authenticated;
grant execute on function public.tkb_import_documents(jsonb,text) to service_role;
commit;

