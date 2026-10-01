const embeddings_Ingestion = embedding({ type: '@n8n/n8n-nodes-langchain.embeddingsGoogleGemini', version: 1, config: { name: 'Embeddings (Ingestion)', credentials: { googlePalmApi: newCredential('Google Gemini(PaLM) Api account 2', 'gkQ7oPm9ZMhq5442') }, position: [2048, 448] } });
const text_Splitter = textSplitter({ type: '@n8n/n8n-nodes-langchain.textSplitterRecursiveCharacterTextSplitter', version: 1, config: { name: 'Text Splitter', parameters: { chunkSize: 2000, chunkOverlap: 200, options: {} }, position: [2304, 640] } });
const document_Loader = documentLoader({ type: '@n8n/n8n-nodes-langchain.documentDefaultDataLoader', version: 1, config: { name: 'Document Loader', parameters: { jsonMode: 'expressionData', jsonData: expr('{{ $json.text }}'), options: { metadata: { metadataValues: [{ name: 'book_id', value: expr('{{ $json.metadata.book_id }}') }, { name: 'source', value: expr('{{ $json.metadata.source }}') }, { name: 'title', value: expr('{{ $json.metadata.title }}') }, { name: 'author', value: expr('{{ $json.metadata.author }}') }, { name: 'file_name', value: expr('{{ $json.metadata.file_name }}') }, { name: 'chunk_index', value: expr('{{ $json.metadata.chunk_index }}') }, { name: 'chunk_version', value: expr('{{ $json.metadata.chunk_version }}') }, { name: 'total_chunks', value: expr('{{ $json.metadata.total_chunks }}') }] } } }, position: [2224, 448], subnodes: { textSplitter: text_Splitter } } });
const gemini_Chat_Model = languageModel({ type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini', version: 1, config: { name: 'Gemini Chat Model', parameters: { modelName: 'models/gemini-3-flash-preview', options: { temperature: 0 } }, credentials: { googlePalmApi: newCredential('Google Gemini(PaLM) Api account 2', 'gkQ7oPm9ZMhq5442') }, position: [240, 1104] } });
const chat_Memory = memory({ type: '@n8n/n8n-nodes-langchain.memoryBufferWindow', version: 1.3, config: { name: 'Chat Memory', parameters: { contextWindowLength: 10 }, position: [368, 1104] } });
const search_Library = tool({ type: '@n8n/n8n-nodes-langchain.toolWorkflow', version: 2.2, config: { name: 'Search Library', parameters: { description: 'Searches all uploaded books with hybrid search (meaning + exact keywords) and returns the 4 most relevant passages with their book title. Call it for every question.', workflowId: { __rl: true, mode: 'id', value: 'TKY170HogPciq8hz' }, workflowInputs: { mappingMode: 'defineBelow', value: { query: expr('{{ $fromAI(\'query\', \'Focused search query, ideally in English since the books are in English\', \'string\') }}') }, matchingColumns: [], schema: [{ id: 'query', displayName: 'query', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }], attemptToConvertTypes: false, convertFieldsToString: false } }, position: [560, 1120] } });

const upload_Book = trigger({
  type: 'n8n-nodes-base.formTrigger',
  version: 2.6,
  config: { name: 'Upload Book', parameters: { formTitle: 'Book Library Chatbot', formDescription: 'Click the button to open the chatbot. To add a book to the library, attach its PDF (and optionally its title and author) first: loading takes about 1 minute per 50 pages on the Gemini free tier, then the chatbot opens. Re-uploading the same file resumes or refreshes only that book.', formFields: { values: [{ fieldLabel: 'PDF (only to add or reload a book)', fieldType: 'file', fieldName: 'pdf', multipleFiles: false, acceptFileTypes: '.pdf' }, { fieldLabel: 'Title (optional, defaults to the file name)', fieldName: 'title' }, { fieldLabel: 'Author (optional)', fieldName: 'author' }] }, options: { buttonLabel: 'Open the chatbot' } }, webhookId: '5bb828bc-bd25-4c49-a0e5-96168f2bbc0b' }
});

const pDF_Provided = node({
  type: 'n8n-nodes-base.if',
  version: 2.3,
  config: { name: 'PDF Provided?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 }, conditions: [{ id: '0a6432a2-56f5-41ae-b101-104944c68392', leftValue: expr('{{ !!($binary && $binary.pdf) }}'), rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, looseTypeValidation: true, options: {} }, position: [160, 0] }
});

const extract_Text_from_PDF = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: { name: 'Extract Text from PDF', parameters: { operation: 'pdf', binaryPropertyName: 'pdf', options: {} }, position: [304, 0] }
});

const identify_Book = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Identify Book', parameters: { jsCode: '// Identify the uploaded book: a stable id from the file name + size, so re-uploading\n// the same file resumes/replaces only that book. Title/author come from the form.\nconst form = $(\'Upload Book\').first().json;\nconst file = form.pdf || {};\nconst fileName = String(file.filename || \'book.pdf\');\nconst base = fileName.replace(/\\.[^.]+$/, \'\');\nconst slug = base.toLowerCase().normalize(\'NFD\').replace(/[̀-ͯ]/g, \'\')\n  .replace(/[^a-z0-9]+/g, \'-\').replace(/^-+|-+$/g, \'\') || \'book\';\nconst clean = (s) => String(s ?? \'\').replace(/\\$/g, \'\').trim(); // values go into $q$-quoted SQL\n\nreturn [{\n  json: {\n    book_id: `${slug}-${file.size || 0}`,\n    title: clean(form.title) || clean(base.replace(/[_-]+/g, \' \')),\n    author: clean(form.author),\n    file_name: clean(fileName),\n  },\n}];\n' }, position: [528, 0] }
});

const register_Book = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.7,
  config: { name: 'Register Book', parameters: { operation: 'executeQuery', query: 'insert into public.books (id, title, author, file_name, status)\nvalues (\'{{ $json.book_id }}\', $q${{ $json.title }}$q$, nullif($q${{ $json.author }}$q$, \'\'), $q${{ $json.file_name }}$q$, \'loading\')\non conflict (id) do update\n  set title = excluded.title,\n      author = coalesce(excluded.author, public.books.author),\n      file_name = excluded.file_name,\n      status = \'loading\',\n      updated_at = now()\nreturning id;', options: {} }, credentials: { postgres: newCredential('Postgres Credential', 'bBPYDW3NiNmO9oHT') }, position: [752, 0], executeOnce: true }
});

const remove_Old_Chunks = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: { name: 'Remove Old Chunks', parameters: { method: 'DELETE', url: 'https://rjkynlfmdlpzgtgjxhft.supabase.co/rest/v1/documents', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi', sendQuery: true, queryParameters: { parameters: [{ name: 'metadata->>book_id', value: expr('eq.{{ $(\'Identify Book\').first().json.book_id }}') }, { name: 'metadata->>chunk_version', value: 'neq.v3' }] }, sendHeaders: true, headerParameters: { parameters: [{ name: 'Prefer', value: 'return=minimal' }] }, options: {} }, credentials: { supabaseApi: newCredential('Credential RAG', 'vG1oa3UwgkecsDCc') }, position: [960, 0], alwaysOutputData: true }
});

const get_Stored_Chunks = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.7,
  config: { name: 'Get Stored Chunks', parameters: { operation: 'executeQuery', query: 'select coalesce(array_agg((metadata->>\'chunk_index\')::int), \'{}\') as stored\nfrom public.documents\nwhere metadata->>\'book_id\' = \'{{ $(\'Identify Book\').first().json.book_id }}\'\n  and metadata->>\'chunk_version\' = \'v3\';', options: {} }, credentials: { postgres: newCredential('Postgres Credential', 'bBPYDW3NiNmO9oHT') }, position: [1184, 0], executeOnce: true }
});

const chunk_Book = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Chunk Book', parameters: { jsCode: '// Clean the book text, split it into ~2000 char chunks (200 overlap) and skip\n// chunks of THIS book already stored in Supabase, so a re-run resumes where it stopped.\n// Bigger chunks = fewer Gemini embedding requests (free tier: ~100/min, 1000/day).\nconst BOOK = $(\'Identify Book\').first().json;\nconst VERSION = \'v3\';\nconst SIZE = 2000;\nconst OVERLAP = 200;\nconst MIN_ALNUM = 40;\n\nfunction clean(raw) {\n  return String(raw ?? \'\')\n    .replace(/\\u0000/g, \'\')\n    .replace(/\\r\\n?/g, \'\\n\')\n    .replace(/[ \\t\\f\\v]+/g, \' \')\n    .replace(/­/g, \'\')\n    .replace(/(\\w)-\\n(\\w)/g, \'$1$2\')\n    .replace(/^\\s*(page\\s+)?\\d+(\\s+of\\s+\\d+)?\\s*$/gim, \'\')\n    .replace(/[ ]{2,}/g, \' \')\n    .replace(/ *\\n */g, \'\\n\')\n    .replace(/\\n{3,}/g, \'\\n\\n\')\n    .trim();\n}\n\nfunction split(text, seps) {\n  if (text.length <= SIZE) return [text];\n  const sep = seps.find((s) => s === \'\' || text.includes(s));\n  const rest = seps.slice(seps.indexOf(sep) + 1);\n  const parts = sep === \'\' ? text.split(\'\') : text.split(sep);\n  const out = [];\n  let cur = \'\';\n  for (const p of parts) {\n    if (p.length > SIZE) {\n      if (cur) out.push(cur);\n      cur = \'\';\n      out.push(...split(p, rest));\n      continue;\n    }\n    const cand = cur ? cur + sep + p : p;\n    if (cand.length <= SIZE) {\n      cur = cand;\n      continue;\n    }\n    out.push(cur);\n    let tail = cur.slice(-OVERLAP);\n    const sp = tail.indexOf(\' \');\n    tail = sp >= 0 ? tail.slice(sp + 1) : tail;\n    cur = tail && (tail + sep + p).length <= SIZE ? tail + sep + p : p;\n  }\n  if (cur) out.push(cur);\n  return out;\n}\n\nconst text = clean($(\'Extract Text from PDF\').first().json.text);\nif (!text) throw new Error(\'No text extracted from the PDF (scanned/image-only file?)\');\n\nconst chunks = split(text, [\'\\n\\n\', \'\\n\', \'. \', \' \', \'\'])\n  .map((c) => c.trim())\n  .filter((c) => (c.match(/[\\p{L}\\p{N}]/gu) || []).length >= MIN_ALNUM);\n\nconst stored = new Set(($(\'Get Stored Chunks\').first().json.stored || []).map(Number));\n\nconst remaining = chunks\n  .map((t, i) => ({ t, i }))\n  .filter(({ i }) => !stored.has(i));\n\nif (remaining.length === 0) {\n  return [{ json: { alreadyDone: true, total: chunks.length } }];\n}\n\nreturn remaining.map(({ t, i }) => ({\n  json: {\n    alreadyDone: false,\n    text: t,\n    metadata: {\n      book_id: BOOK.book_id,\n      source: BOOK.title,\n      title: BOOK.title,\n      author: BOOK.author,\n      file_name: BOOK.file_name,\n      chunk_index: i,\n      chunk_version: VERSION,\n      total_chunks: chunks.length,\n    },\n  },\n}));\n' }, position: [1408, 0] }
});

const already_Loaded = node({
  type: 'n8n-nodes-base.if',
  version: 2.3,
  config: { name: 'Already Loaded?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 }, conditions: [{ id: '51ea114c-34f3-4b75-9380-6955bdccdb3c', leftValue: expr('{{ $json.alreadyDone }}'), rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, looseTypeValidation: true, options: {} }, position: [1632, 0] }
});

const mark_Book_Complete = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.7,
  config: { name: 'Mark Book Complete', parameters: { operation: 'executeQuery', query: 'update public.books\nset status = \'complete\',\n    total_chunks = {{ Number($(\'Chunk Book\').first().json.total ?? $(\'Chunk Book\').first().json.metadata?.total_chunks ?? 0) }},\n    updated_at = now()\nwhere id = \'{{ $(\'Identify Book\').first().json.book_id }}\'\nreturning id, title, total_chunks;', options: {} }, credentials: { postgres: newCredential('Postgres Credential', 'bBPYDW3NiNmO9oHT') }, position: [2080, -208], executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput' }
});

const get_a_row = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: { name: 'Get a row', parameters: { operation: 'getAll', tableId: 'documents', limit: 1 }, credentials: { supabaseApi: newCredential('Credential RAG', 'vG1oa3UwgkecsDCc') }, position: [2304, -208], executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput' }
});

const execute_a_SQL_query = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.7,
  config: { name: 'Execute a SQL query', parameters: { operation: 'executeQuery', query: 'select (select count(*) from public.books where status = \'complete\')::int as books,\n       (select count(*) from public.documents)::int as stored_chunks,\n       (select string_agg(title, \' · \' order by created_at) from public.books where status = \'complete\') as titles;', options: {} }, credentials: { postgres: newCredential('Postgres Credential', 'bBPYDW3NiNmO9oHT') }, position: [2528, -208], executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput' }
});

const open_Chatbot = node({
  type: 'n8n-nodes-base.form',
  version: 2.5,
  config: { name: 'Open Chatbot', parameters: { operation: 'completion', respondWith: 'showText', responseText: expr('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bibliothèque - Chatbot prêt</title>\n<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f6f7fb;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1f2330}\n.card{background:#fff;border:1px solid #e3e5ec;border-radius:12px;padding:40px 36px;max-width:500px;width:calc(100% - 32px);text-align:center;box-shadow:0 4px 18px rgba(0,0,0,.05)}\nh1{font-size:24px;margin:0 0 8px}p{color:#5b6070;margin:0 0 24px;line-height:1.5}\n.btn{display:inline-block;background:#ff6d5a;color:#fff;text-decoration:none;font-weight:600;font-size:17px;padding:16px 32px;border-radius:8px}\n.btn:hover{background:#f25a46}.stat{margin-top:20px;font-size:13px;color:#8a8f9c;line-height:1.6}</style></head>\n<body><div class="card"><h1>Le chatbot est prêt</h1>\n<p>Posez vos questions : le chatbot répond uniquement à partir des livres de votre bibliothèque et cite ses sources.</p>\n<a class="btn" href="https://smorlot.app.n8n.cloud/webhook/4e2cc1fc-85e9-4f32-a173-d55642b6200d/chat" target="_blank" rel="noopener">Ouvrir le chatbot</a>\n<div class="stat">{{ $json.books || 0 }} livre(s) · {{ $json.stored_chunks || 0 }} passages<br>{{ $json.titles || \'\' }}</div></div></body></html>') }, position: [2752, -208], webhookId: 'c4ff5a4a-dafe-484e-9d30-49d7ab4610bc' }
});

const loop_Over_Chunks = node({
  type: 'n8n-nodes-base.splitInBatches',
  version: 3,
  config: { name: 'Loop Over Chunks', parameters: { batchSize: 50, options: {} }, position: [1840, 128] }
});

const store_in_Supabase = node({
  type: '@n8n/n8n-nodes-langchain.vectorStoreSupabase',
  version: 1.1,
  config: { name: 'Store in Supabase', parameters: { mode: 'insert', tableName: { __rl: true, value: 'documents', mode: 'id' }, embeddingBatchSize: 50, options: { queryName: 'match_documents' } }, credentials: { supabaseApi: newCredential('Credential RAG', 'vG1oa3UwgkecsDCc') }, position: [2080, 224], subnodes: { embedding: embeddings_Ingestion, documentLoader: document_Loader } }
});

const pace_for_Free_Tier = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: { name: 'Pace for Free Tier', parameters: { amount: 55 }, position: [2352, 224], webhookId: '3dadfbaa-cc0e-4784-b692-c831670b4ef7' }
});

const chat_With_the_Book = trigger({
  type: '@n8n/n8n-nodes-langchain.chatTrigger',
  version: 1.5,
  config: { name: 'Chat With the Book', parameters: { public: true, initialMessages: 'Hi! Ask me anything about the books in your library.', options: { subtitle: 'Answers come only from your uploaded books', title: 'Book Library Assistant', responseMode: 'lastNode' } }, position: [0, 880], webhookId: '4e2cc1fc-85e9-4f32-a173-d55642b6200d' }
});

const aI_Agent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 1.7,
  config: { name: 'AI Agent', parameters: { promptType: 'define', text: expr('{{ $json.chatInput }}'), options: { systemMessage: 'You are an expert assistant for a library of books uploaded by the user.\nAnswer questions based EXCLUSIVELY on the passages returned by the library search tool.\nIf the answer is not in those passages, say you don\'t know and do not use outside knowledge.\nAlways cite the book title (and author if known) of the passages you use.\nCall the search tool for every question with a focused search query in English (the books are in English); you may call it several times with different queries.\nAnswer in the language of the question.', maxIterations: 5 } }, position: [288, 880], subnodes: { model: gemini_Chat_Model, memory: chat_Memory, tools: [search_Library] } }
});

const search_Request = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: { name: 'Search Request', parameters: { workflowInputs: { values: [{ name: 'query' }] } }, position: [0, 1504] }
});

const embed_Query = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: { name: 'Embed Query', parameters: { method: 'POST', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent', authentication: 'predefinedCredentialType', nodeCredentialType: 'googlePalmApi', sendBody: true, specifyBody: 'json', jsonBody: expr('{{ JSON.stringify({ model: \'models/gemini-embedding-001\', content: { parts: [{ text: $json.query }] } }) }}'), options: {} }, credentials: { googlePalmApi: newCredential('Google Gemini(PaLM) Api account 2', 'gkQ7oPm9ZMhq5442') }, position: [240, 1504] }
});

const hybrid_Search = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.7,
  config: { name: 'Hybrid Search', parameters: { operation: 'executeQuery', query: 'select id, content, metadata, score\nfrom public.hybrid_search(\n  $q${{ String($(\'Search Request\').first().json.query || \'\').replace(/\\$/g, \'\') }}$q$,\n  \'{{ JSON.stringify($json.embedding.values) }}\'::vector,\n  4\n);', options: {} }, credentials: { postgres: newCredential('Postgres Credential', 'bBPYDW3NiNmO9oHT') }, position: [480, 1504], alwaysOutputData: true }
});

const format_Passages = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Format Passages', parameters: { jsCode: '// Turn the hybrid-search rows into one text block the agent can cite.\nconst rows = $input.all().map((i) => i.json).filter((r) => r && r.content);\nif (rows.length === 0) return [{ json: { response: \'No relevant passage found in the library.\' } }];\nconst text = rows.map((r, i) => {\n  const m = r.metadata || {};\n  const who = m.author ? ` by ${m.author}` : \'\';\n  return `[${i + 1}] "${m.title || \'Unknown book\'}"${who}, passage ${m.chunk_index ?? \'?\'}\\n${r.content}`;\n}).join(\'\\n\\n---\\n\\n\');\nreturn [{ json: { response: text } }];' }, position: [720, 1504] }
});

const wf = workflow('TKY170HogPciq8hz', 'AI In Finance - Book Chatbot', { executionOrder: 'v1', availableInMCP: true, binaryMode: 'separate' });

export default wf
  .add(upload_Book)
  .to(pDF_Provided.onTrue(extract_Text_from_PDF
    .to(identify_Book)
    .to(register_Book)
    .to(remove_Old_Chunks)
    .to(get_Stored_Chunks)
    .to(chunk_Book)
    .to(already_Loaded.onTrue(mark_Book_Complete
      .to(get_a_row)
      .to(execute_a_SQL_query)
      .to(open_Chatbot)).onFalse(splitInBatches(loop_Over_Chunks)
      .onEachBatch(store_in_Supabase
        .to(pace_for_Free_Tier)
        .to(nextBatch(loop_Over_Chunks)))
      .onDone(mark_Book_Complete)))).onFalse(get_a_row))
  .add(chat_With_the_Book)
  .to(aI_Agent)
  .add(search_Request)
  .to(embed_Query)
  .to(hybrid_Search)
  .to(format_Passages)