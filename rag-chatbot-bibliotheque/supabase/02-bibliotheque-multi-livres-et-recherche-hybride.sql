-- Multi-book library + hybrid search for the "AI In Finance - Book Chatbot" n8n workflow.
-- Run once in the Supabase SQL Editor. Safe to re-run.

-- 1. Registry of uploaded books --------------------------------------------
create table if not exists public.books (
  id           text primary key,              -- slug of the file name + file size
  title        text not null,
  author       text,
  file_name    text,
  total_chunks int,
  status       text not null default 'loading',  -- loading | complete
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.books enable row level security;

create index if not exists documents_book_id_idx
  on public.documents ((metadata->>'book_id'));

-- 3. Tag the 449 chunks already loaded as the book "AI In Finance" ----------
update public.documents
set metadata = metadata || jsonb_build_object(
  'book_id',   'ai-in-finance-9291421',
  'title',     'AI In Finance',
  'author',    'Krishan Arora',
  'file_name', 'AI_In_Finance.pdf'
)
where metadata->>'book_id' is null;

insert into public.books (id, title, author, file_name, total_chunks, status)
values ('ai-in-finance-9291421', 'AI In Finance', 'Krishan Arora', 'AI_In_Finance.pdf', 449, 'complete')
on conflict (id) do update
  set status = 'complete', total_chunks = excluded.total_chunks, updated_at = now();

-- 5. Hybrid search: vectors + keywords, fused with Reciprocal Rank Fusion ---
alter table public.documents
  add column if not exists fts tsvector
  generated always as (to_tsvector('english', coalesce(content, ''))) stored;

create index if not exists documents_fts_idx on public.documents using gin (fts);

create or replace function public.hybrid_search(
  query_text       text,
  query_embedding  vector(3072),
  match_count      int   default 4,
  filter           jsonb default '{}',
  full_text_weight float default 1,
  semantic_weight  float default 1,
  rrf_k            int   default 50
)
returns table (id bigint, content text, metadata jsonb, score float)
language sql stable
as $$
  with q as (
    -- any word of the question can match (OR), not all of them
    select to_tsquery('english', coalesce(
      (select string_agg(quote_literal(lexeme), ' | ')
         from unnest(to_tsvector('english', query_text))), '')) as tsq
  ),
  full_text as (
    select d.id,
           row_number() over (order by ts_rank_cd(d.fts, q.tsq) desc) as rank_ix
    from public.documents d, q
    where d.fts @@ q.tsq and d.metadata @> filter
    order by rank_ix
    limit least(match_count, 30) * 2
  ),
  semantic as (
    select d.id,
           row_number() over (order by d.embedding <=> query_embedding) as rank_ix
    from public.documents d
    where d.metadata @> filter
    order by rank_ix
    limit least(match_count, 30) * 2
  )
  select d.id, d.content, d.metadata,
         coalesce(1.0 / (rrf_k + ft.rank_ix), 0.0) * full_text_weight
       + coalesce(1.0 / (rrf_k + s.rank_ix), 0.0) * semantic_weight as score
  from full_text ft
  full outer join semantic s on ft.id = s.id
  join public.documents d on d.id = coalesce(ft.id, s.id)
  order by score desc
  limit least(match_count, 30);
$$;

-- Check: expect 1 book, 449 chunks, 449 tagged, and some keyword matches
select (select count(*) from public.books)                                    as books,
       (select count(*) from public.documents)                                as chunks,
       (select count(*) from public.documents where metadata ? 'book_id')     as tagged_chunks,
       (select count(*) from public.documents
         where fts @@ to_tsquery('english', 'credit | scoring'))              as keyword_matches;
