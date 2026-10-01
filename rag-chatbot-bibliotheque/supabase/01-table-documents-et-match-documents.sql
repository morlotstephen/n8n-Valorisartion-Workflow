-- Run once in the Supabase SQL Editor before executing the ingestion workflow.
-- The vector size (3072) must match the embedding model used in both workflows
-- (models/gemini-embedding-001 -> 3072 dimensions).

create extension if not exists vector;

create table if not exists documents (
  id bigserial primary key,
  content text,            -- Document.pageContent
  metadata jsonb,          -- Document.metadata
  embedding vector(3072)
);

create or replace function match_documents (
  query_embedding vector(3072),
  match_count int default null,
  filter jsonb default '{}'
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where metadata @> filter
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- No ANN index: pgvector's hnsw/ivfflat indexes are limited to 2000 dimensions
-- for the `vector` type, and a single book (a few thousand chunks) is fast
-- enough with an exact scan.

-- To re-ingest from scratch:
-- truncate table documents restart identity;
