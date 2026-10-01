---
name: n8n-deploiement-mcp
description: Créer, modifier et publier un workflow sur l'instance n8n Cloud smorlot.app.n8n.cloud depuis ce dépôt, sans clé API REST — n8ncli pour créer, serveur MCP de l'instance (update_workflow, publish_workflow, execute_workflow) pour modifier, publier et tester. À utiliser dès qu'un workflow existant doit être changé sur l'instance, quand « n8ncli push » affiche UPDATED sans effet, ou pour exécuter et inspecter un workflow à distance.
---

# Déployer sur n8n Cloud sans clé API

## Le piège

La configuration `n8ncli` (`~/.n8ncli-global.json`, environnement `prod`) n'a pas de clé API
REST. Pour un workflow **existant**, `n8ncli push` tente l'API REST, échoue silencieusement, se
rabat sur un appel MCP qui ne fait que renommer le workflow, puis affiche `[UPDATED]`. Rien n'est
modifié. `n8ncli diff`/`pull` ne suffisent pas à le détecter : vérifier sur l'instance.

| Action | Outil qui marche |
|---|---|
| Créer un workflow | `n8ncli push <fichier>` (fichier `.json` ou `.workflow.ts` dans `n8n/workflows/`) |
| Modifier un workflow existant | MCP `update_workflow` (opérations) |
| Publier | `n8ncli publish <id>` ou MCP `publish_workflow` |
| Tester | MCP `execute_workflow` puis `get_workflow_execution` |
| Lire l'état réel | MCP `get_workflow_details` (`n8ncli pull` fonctionne aussi) |

## Appeler le serveur MCP de l'instance

URL : `<instanceUrl>/mcp-server/http`, en-tête `Authorization: Bearer <accessToken>` lus dans
`~/.n8ncli-global.json`. Ne jamais afficher ni commiter le jeton. Client minimal (Node, SDK
`@modelcontextprotocol/sdk` fourni avec n8ncli) :

```js
const env = JSON.parse(fs.readFileSync(`${os.homedir()}/.n8ncli-global.json`, 'utf8')).environments.prod;
const transport = new StreamableHTTPClientTransport(new URL(env.instanceUrl + '/mcp-server/http'),
  { requestInit: { headers: { Authorization: `Bearer ${env.accessToken}` } } });
const client = new Client({ name: 'deploy', version: '1.0.0' });
await client.connect(transport);
await client.callTool({ name: 'update_workflow', arguments: { workflowId, operations } });
```

## update_workflow : opérations utiles

`updateNodeParameters` (avec `replace: true` pour tout remplacer), `setNodeParameter`
(`path` en JSON Pointer, ex. `/formFields/values`), `addNode`, `removeNode`, `addConnection` /
`removeConnection` (`sourceIndex` pour les sorties d'un IF ou d'une boucle, `connectionType`
pour `ai_tool`…), `setNodeSettings` (`executeOnce`, `alwaysOutputData`, `onError`),
`setNodePosition`. Le lot est atomique (max 100 opérations) ; lire `appliedOperations` et
`validationWarnings` dans la réponse.

## Pièges rencontrés

- Champ `query` du nœud Postgres : pas de préfixe `=`, les `{{ }}` sont résolus directement.
- Un index hors limites dans `setNodeParameter` échoue : remplacer le tableau entier.
- La création régénère les `webhookId` des déclencheurs chat : relire `get_workflow_details`
  avant de construire une URL de chat.
- Trop d'appels rapprochés → `Too many requests` : attendre ~2 minutes.
- Modifier le brouillon ne change pas la version publique : republier après chaque modification.
- Ne pas modifier un workflow pendant qu'une exécution longue tourne dans l'éditeur ouvert par
  l'utilisateur : l'éditeur peut réenregistrer l'ancienne version.

## Vérifier avant de dire « c'est fait »

1. `get_workflow_details` : nœuds et connexions attendus présents.
2. `publish_workflow` : `success: true`.
3. Exécution réelle (formulaire en production ou `execute_workflow`) et lecture des sorties
   nœud par nœud. Un `[UPDATED]` ou un `appliedOperations` ne prouve pas que ça marche.
