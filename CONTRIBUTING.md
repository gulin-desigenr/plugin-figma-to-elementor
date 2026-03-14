# Guia de Contribuição — Figmentor

## 🌿 Workflow de Branches

```
feature/minha-feature  →  dev  →  main
fix/meu-bugfix         →  dev  →  main
```

1. Sempre criar branch a partir de `dev`
2. Nomear branches como `feature/descricao` ou `fix/descricao`
3. Fazer merge para `dev` via Pull Request
4. Merge de `dev` para `main` apenas quando estável

## ✍️ Padrão de Commits

Formato: `tipo: descrição curta em português`

| Prefixo | Uso |
|---|---|
| `feat:` | Nova funcionalidade |
| `fix:` | Correção de bug |
| `refactor:` | Refatoração sem mudar comportamento |
| `docs:` | Documentação |
| `style:` | Formatação, sem mudança de lógica |
| `chore:` | Tarefas de manutenção |

**Exemplos:**
```
feat: adicionar handler para icon-box
fix: corrigir crash com cornerRadius misto
docs: atualizar README com novas tags
refactor: extrair funções de estilo para módulo separado
```

## 📐 Padrões de Código

### Geral
- **Código**: nomes de variáveis e funções em **inglês**
- **UI/Mensagens**: textos visíveis ao usuário em **português**
- **Indentação**: 2 espaços
- **Ponto-e-vírgula**: obrigatório

### Ao adicionar um novo widget
1. Adicionar handler em `code.js` dentro de `handleManualTag()`
2. Adicionar botão correspondente em `ui.html`
3. Atualizar tabela de tags no `README.md`
4. Adicionar entrada no `CHANGELOG.md`

### Documentação de funções (JSDoc)
```javascript
/**
 * Extrai as bordas de um nó Figma e popula o objeto settings.
 * @param {SceneNode} node - Nó do Figma a ser processado
 * @param {Object} settings - Objeto de settings do Elementor a ser populado
 * @param {boolean} [isWidget=false] - Se o nó é um widget (prefixo diferente)
 * @param {string} [widgetType=""] - Tipo do widget para keys específicas
 */
function extractBorders(node, settings, isWidget = false, widgetType = "") {
```

## 🧪 Teste antes de Merge

1. Abra o plugin no Figma Desktop
2. Crie um frame com todos os tipos de widget suportados
3. Aplique tags manualmente
4. Exporte o JSON
5. Importe no Elementor e verifique:
   - Layout direction correto
   - Cores, fontes e tamanhos preservados
   - Bordas e sombras aplicadas
   - Containers com largura correta
