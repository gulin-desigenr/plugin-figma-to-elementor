# Feature 09 — permitir detectar WordPress local (Local by WP Engine) via HTTP

**Modelo recomendado:** o modelo mais capaz disponível no Antigravity (ex.: Gemini 3 Pro ou equivalente), esforço/thinking alto.
**Natureza:** ajuste pontual pra destravar teste local, decidido com o Pedro em 2026-09-06. Ele está validando as últimas correções contra um WordPress local (app "Local", da WP Engine) porque não tem site próprio disponível agora, e a extensão está recusando a aba porque ela não é HTTPS — sites do Local rodam em HTTP por padrão, e mesmo depois de ativar SSL no Local, o certificado não ficou confiável no macOS.

## Objetivo

A extensão hoje só aceita conectar a abas `https://`, por segurança — evita que o nonce/token do WordPress trafeguem em texto puro numa rede. Isso está certo para uso normal, mas bloqueia completamente qualquer ambiente de desenvolvimento local, que tipicamente roda em HTTP simples.

A correção **não é** aceitar qualquer HTTP — é reconhecer especificamente hosts de desenvolvimento local, onde o tráfego nunca sai da própria máquina (não existe uma rede pra interceptar), como aceitáveis mesmo sem HTTPS. Isso segue o mesmo critério que navegadores já usam pra decidir "contexto seguro" (a spec Secure Contexts do W3C trata `localhost`/`127.0.0.1` como seguros independente do protocolo). Hosts aceitos, além de qualquer `https://`:
- `localhost`
- `127.0.0.1`
- qualquer host terminado em `.local` (ex.: `figmentor-teste.local`, usado pelo app Local)
- qualquer host terminado em `.test` (usado por outras ferramentas de dev, ex.: Lando, DDEV)

Nenhum outro domínio HTTP deve ser aceito.

## Causa raiz (duas camadas, as duas precisam mudar)

1. **`extension/popup.js`**, função `detectWordPress` (por volta da linha 226):
   ```js
   if (!tab?.id || !tab.url || !/^https:\/\//.test(tab.url)) {
     setStatus("A aba ativa não é uma página HTTPS disponível para o WordPress.", true, "elementor");
     return;
   }
   ```
   Só aceita `https://` explicitamente.

2. **`extension/manifest.json`**, `optional_host_permissions` (linha 26-28):
   ```json
   "optional_host_permissions": [
     "https://*/*"
   ]
   ```
   Mesmo corrigindo o item 1, `chrome.permissions.request({ origins: [...] })` (chamado logo depois, na mesma função) falha para qualquer origem `http://`, porque o Chrome só permite pedir permissão pra padrões já declarados aqui no manifest. As duas camadas bloqueiam independentemente — corrigir só uma não resolve.

## Alterações permitidas

### 1. `extension/src/wordpress.js`

Adicionar uma função exportada nova, `isAllowedWordPressTabUrl(url)`, que centraliza essa regra (pra poder ser testada diretamente, sem precisar mockar `chrome.tabs`):

```js
const LOCAL_DEV_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);
const LOCAL_DEV_HOST_SUFFIXES = [".local", ".test"];

export function isAllowedWordPressTabUrl(url) {
  if (typeof url !== "string" || !url) return false;
  if (/^https:\/\//.test(url)) return true;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:") return false;
  return (
    LOCAL_DEV_HOSTNAMES.has(parsed.hostname) ||
    LOCAL_DEV_HOST_SUFFIXES.some((suffix) => parsed.hostname.endsWith(suffix))
  );
}
```

Posicione essa função e as duas constantes perto do topo do arquivo, junto das outras constantes/funções utilitárias já existentes (ex.: perto de `normalizeRestRoot`, se houver algo parecido).

### 2. `extension/popup.js`

- Importar `isAllowedWordPressTabUrl` de `./src/wordpress.js` (adicione ao import já existente desse módulo, não crie um import novo separado).
- Trocar a checagem em `detectWordPress`:
  ```js
  if (!tab?.id || !isAllowedWordPressTabUrl(tab.url)) {
    setStatus(
      "A aba ativa não é HTTPS nem um ambiente local reconhecido (localhost, 127.0.0.1, *.local, *.test).",
      true,
      "elementor"
    );
    return;
  }
  ```

### 3. `extension/manifest.json`

Adicionar os padrões de host local em `optional_host_permissions`, mantendo o `https://*/*` que já existe:
```json
"optional_host_permissions": [
  "https://*/*",
  "http://localhost/*",
  "http://127.0.0.1/*",
  "http://*.local/*",
  "http://*.test/*"
]
```

### 4. `tests/extension.test.js`

Adicionar um teste novo pra `isAllowedWordPressTabUrl`, importando-a de `../extension/src/wordpress.js` (adicione ao import já existente desse módulo). Cobrir pelo menos:
- `https://qualquer-dominio.com` → `true`
- `http://localhost:10004` → `true` (Local costuma rodar em portas customizadas — confirme que a checagem de hostname ignora a porta corretamente, já que `new URL(...).hostname` não inclui a porta)
- `http://127.0.0.1` → `true`
- `http://figmentor-teste.local` → `true`
- `http://meusite.test` → `true`
- `http://meusite.com` → `false` (HTTP normal continua bloqueado)
- `http://evil.local.attacker.com` → `false` (não deixe um domínio terminar em ".local.attacker.com" passar só por conter ".local" no meio — a checagem deve ser sufixo real do hostname, não `includes`)
- uma URL malformada (ex.: `"not-a-url"`) → `false`, sem lançar exceção

### 5. `CHANGELOG.md`

Adicionar uma linha em `### Added` (ou `### Changed`) sob `[Unreleased]` descrevendo que a extensão agora aceita WordPress local (`localhost`, `127.0.0.1`, `*.local`, `*.test`) sem exigir HTTPS, mantendo a exigência de HTTPS pra qualquer outro domínio.

Nenhum outro arquivo deve ser tocado.

## Estado e preservação

- Repositório: `/Users/pedrogulin/Developer/[01.2] PLUGIN FIGMA TO ELEMENTOR__feature_elementor_bridge`; branch `feature/permitir-wordpress-local-http` (criada a partir de `main` em 2026-09-06). **Confirme que está nessa branch** (`git branch --show-current`) antes de editar.
- O working tree deve estar limpo, exceto pela pasta não rastreada `docs/prompts/`. Se `git status --short` mostrar outra coisa, pare e reporte.
- Não faça commit, push, reset, checkout, clean ou stash.

## Fora de escopo absoluto

- Aceitar qualquer HTTP genérico — só os hosts locais listados.
- Mexer em qualquer outra validação de segurança (nonce, nonce do Elementor, `validateWordPressContext`, `world: "MAIN"`).
- Mexer em `src/` (motor do plugin Figma).
- Fazer commit, push, reset, checkout, clean ou stash.

## Validação obrigatória

```bash
npm run check
git diff --check
```

Hoje são 57 testes; deve continuar tudo passando mais os novos testes de `isAllowedWordPressTabUrl` (pelo menos 8 casos novos, então 65+ no total).

## Entrega

Escreva um relatório completo em `docs/relatorios/09-permitir-wordpress-local-via-http.md` (diffs de `wordpress.js`, `popup.js`, `manifest.json`, os testes novos, e o resultado exato de `npm run check`). Depois responda no chat **só** com este formato:

```
Feature 09 concluída sem commit ou push.

- <o que foi implementado, 1 linha>
- Testes: X arquivos, Y testes aprovados; typecheck/build/format [status]
- Lint: [status]

Relatório: <caminho completo do arquivo>
```

Pare após isso — não commite.
