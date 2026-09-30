const manual_Start = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Manual Start', position: [0, 260] }
});

const create_Valuation_File = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: { name: 'Create Valuation File', parameters: { resource: 'spreadsheet', operation: 'create', title: expr('Valorisation {{ $now.toFormat(\'yyyy-MM-dd HH:mm\') }}'), sheetsUi: { sheetValues: [{ title: 'Valorisation' }] }, options: {} }, credentials: { googleSheetsOAuth2Api: newCredential('Google Sheets account', 'fswKRmTW22QEZSFF') }, position: [220, 260], notes: 'Creates a new Google Sheets file in the Drive of the connected Google account.', notesInFlow: true }
});

const read_Positions = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: { name: 'Read Positions', parameters: { documentId: { __rl: true, value: '1DF_MXVCSq31dGjbZ0GGGQ5XbAaVazdf9bZr01qkcmFU', mode: 'list', cachedResultName: 'Untitled spreadsheet', cachedResultUrl: 'https://docs.google.com/spreadsheets/d/1DF_MXVCSq31dGjbZ0GGGQ5XbAaVazdf9bZr01qkcmFU/edit?usp=drivesdk' }, sheetName: { __rl: true, value: 'gid=0', mode: 'list', cachedResultName: 'Feuille 1', cachedResultUrl: 'https://docs.google.com/spreadsheets/d/1DF_MXVCSq31dGjbZ0GGGQ5XbAaVazdf9bZr01qkcmFU/edit#gid=0' }, options: {} }, credentials: { googleSheetsOAuth2Api: newCredential('Google Sheets account', 'fswKRmTW22QEZSFF') }, position: [440, 260], notes: 'Reads portfolio positions. Expected columns: Ticker, Devise, Quantite.', notesInFlow: true }
});

const is_USD = node({
  type: 'n8n-nodes-base.if',
  version: 2.3,
  config: { name: 'Is USD', parameters: { conditions: { options: { caseSensitive: false, leftValue: '', typeValidation: 'loose', version: 2 }, conditions: [{ id: 'c0000000-0000-4000-8000-000000000001', leftValue: expr('{{ String($json.Devise).trim().toUpperCase() }}'), rightValue: 'USD', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' }, options: {} }, position: [640, 260], notes: 'Routes USD positions to Finnhub, all other currencies to Yahoo Finance.', notesInFlow: true }
});

const finnhub_Quote = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: { name: 'Finnhub Quote', parameters: { url: expr('https://finnhub.io/api/v1/quote?symbol={{ encodeURIComponent($json.Ticker) }}'), authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', options: { batching: { batch: { batchSize: 1, batchInterval: 1100 } } } }, credentials: { httpHeaderAuth: newCredential('Clé API Finnhub', 'igxGGm6HxAFBwd67') }, position: [860, 180], notes: 'Needs a Header Auth credential: name X-Finnhub-Token, value = Finnhub API key.', notesInFlow: true }
});

const normalize_Finnhub = node({
  type: 'n8n-nodes-base.set',
  version: 3.5,
  config: { name: 'Normalize Finnhub', parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [{ id: 'n0', name: 'name', type: 'string', value: expr('{{ $(\'Is USD\').item.json.Nom }}') }, { id: 'n1', name: 'isin', type: 'string', value: expr('{{ $(\'Is USD\').item.json.ISIN }}') }, { id: 'n2', name: 'ticker', type: 'string', value: expr('{{ $(\'Is USD\').item.json.Ticker }}') }, { id: 'n3', name: 'currency', type: 'string', value: expr('{{ $(\'Is USD\').item.json.Devise }}') }, { id: 'n4', name: 'previousClose', type: 'number', value: expr('{{ $(\'Is USD\').item.json.Prix_J_Moins_1 }}') }, { id: 'n5', name: 'price', type: 'number', value: expr('{{ $json.c }}') }, { id: 'n9', name: 'source', type: 'string', value: 'Finnhub' }] }, options: {} }, position: [1080, 180] }
});

const merge_Quotes = merge({
  version: 3.2,
  config: { name: 'Merge Quotes', position: [1300, 260] }
});

const yahoo_Finance_Quote = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: { name: 'Yahoo Finance Quote', parameters: { url: expr('https://query1.finance.yahoo.com/v8/finance/chart/{{ encodeURIComponent($json.Ticker) }}?interval=1d&range=1d'), sendHeaders: true, headerParameters: { parameters: [{ name: 'User-Agent', value: 'Mozilla/5.0 (n8n POC Valorisation)' }] }, options: { batching: { batch: { batchSize: 1, batchInterval: 500 } } } }, position: [860, 360], notes: 'Tickers must include the exchange suffix (e.g. MC.PA, SAP.DE).', notesInFlow: true }
});

const normalize_Yahoo = node({
  type: 'n8n-nodes-base.set',
  version: 3.5,
  config: { name: 'Normalize Yahoo', parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [{ id: 'n0', name: 'name', type: 'string', value: expr('{{ $(\'Is USD\').item.json.Nom }}') }, { id: 'n1', name: 'isin', type: 'string', value: expr('{{ $(\'Is USD\').item.json.ISIN }}') }, { id: 'n2', name: 'ticker', type: 'string', value: expr('{{ $(\'Is USD\').item.json.Ticker }}') }, { id: 'n3', name: 'currency', type: 'string', value: expr('{{ $(\'Is USD\').item.json.Devise }}') }, { id: 'n4', name: 'previousClose', type: 'number', value: expr('{{ $(\'Is USD\').item.json.Prix_J_Moins_1 }}') }, { id: 'n5', name: 'price', type: 'number', value: expr('{{ $json.chart.result[0].meta.currency === \'GBp\' ? $json.chart.result[0].meta.regularMarketPrice / 100 : $json.chart.result[0].meta.regularMarketPrice }}') }, { id: 'n9', name: 'source', type: 'string', value: 'Yahoo Finance' }] }, options: {} }, position: [1080, 360] }
});

const write_Valuation = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: { name: 'Write Valuation', parameters: { resource: 'sheet', operation: 'append', documentId: { __rl: true, value: expr('{{ $(\'Create Valuation File\').first().json.spreadsheetId }}'), mode: 'id' }, sheetName: { __rl: true, value: 'Valorisation', mode: 'name' }, columns: { mappingMode: 'defineBelow', value: { Nom: expr('{{ $json.name }}'), ISIN: expr('{{ $json.isin }}'), Ticker: expr('{{ $json.ticker }}'), Devise: expr('{{ $json.currency }}'), Prix_J_Moins_1: expr('{{ $json.previousClose }}'), Valorisation: expr('{{ $json.price }}') }, schema: [{ id: 'Nom', displayName: 'Nom', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'ISIN', displayName: 'ISIN', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'Ticker', displayName: 'Ticker', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'Devise', displayName: 'Devise', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'Prix_J_Moins_1', displayName: 'Prix_J_Moins_1', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true }, { id: 'Valorisation', displayName: 'Valorisation', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true }] }, options: {} }, credentials: { googleSheetsOAuth2Api: newCredential('Google Sheets account', 'fswKRmTW22QEZSFF') }, position: [1520, 260], notes: 'Writes one row per position into the new valuation file, using the same headers as the input sheet.', notesInFlow: true }
});

const wf = workflow('M2thQa8VK7JxNfRJ', 'POC Valorisation', { executionOrder: 'v1', description: 'Reads positions from Google Sheets, prices USD lines with Finnhub and other currencies with Yahoo Finance, then writes the results to a new Google Sheets file in Drive.', availableInMCP: true, binaryMode: 'separate' });

export default wf
  .add(manual_Start)
  .to(create_Valuation_File)
  .to(read_Positions)
  .to(is_USD.onTrue(finnhub_Quote
    .to(normalize_Finnhub)).onFalse(yahoo_Finance_Quote
    .to(normalize_Yahoo)))
  .add(normalize_Finnhub.to(merge_Quotes.input(0)))
  .add(normalize_Yahoo.to(merge_Quotes.input(1)))
  .add(merge_Quotes)
  .to(write_Valuation)