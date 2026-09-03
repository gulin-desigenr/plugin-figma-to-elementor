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
1. Adicionar handler em `src/core/handlers.js` dentro de `handleManualTag()`
2. Adicionar botão correspondente em `ui.html`
3. Atualizar o binding de assets em `extension/src/elementor.js`, quando aplicável
4. Atualizar descoberta/relatório em `extension/src/assets.js`, quando aplicável
5. Adicionar testes do plugin e da extensão
6. Atualizar a tabela de tags no `README.md` e o schema em `ELEMENTOR_WIDGET_MAPPING.md`
7. Executar `npm run build` para atualizar os dois bundles

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

1. Execute `npm run check`
2. Confirme que `dist/code.js` e `extension/dist/popup.js` foram regenerados
3. Abra o plugin no Figma Desktop
4. Crie um frame com todos os tipos de widget suportados
5. Aplique tags e registre a raiz
6. Na extensão, teste seleção atual e frame registrado
7. Gere o documento nos modos página e seção
8. Insira usando uma sessão WordPress de teste e verifique:
   - Layout direction correto
   - Cores, fontes e tamanhos preservados
   - Bordas e sombras aplicadas
   - Containers com largura correta
   - IDs e URLs reais em imagens/backgrounds
   - Continuação e relatório depois de um asset falho
   - Status `draft`
   - Persistência depois do reload

### Regra de responsabilidade

- O plugin Figma trata tags, papéis, plugin data e frame registrado.
- O motor em `src/core/` e `src/styles/` é compartilhado; não crie um mapper
  paralelo simplificado dentro da extensão.
- A extensão trata API REST do Figma, assets, WordPress e Elementor.
- Metadados Figmentor ficam no sidecar e nunca misturados aos controles nativos
  `image`, `background_image`, `carousel` ou `selected_icon`.
- Uma falha de asset deve ser reportada e permitir retry, sem abortar o documento.
- Nunca enviar `selected_icon` com `library: "svg"` sem `value.id` e `value.url`
  válidos. Em caso de upload SVG pendente ou falho, usar o placeholder explícito
  `fas fa-check`, registrar a falha no sidecar/relatório e manter o retry disponível.
- Não reporte sucesso até confirmar `draft` e persistência após reload.
