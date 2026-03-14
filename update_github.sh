#!/bin/bash

# ============================================================
# Figmentor — Script de Push Seguro
# Faz commit e push na branch ATUAL (nunca na main diretamente)
# ============================================================

CURRENT_BRANCH=$(git branch --show-current)

# Bloquear push direto na main
if [ "$CURRENT_BRANCH" = "main" ]; then
    echo "❌ ERRO: Você está na branch 'main'!"
    echo "   Nunca faça push direto na main."
    echo "   Use: git checkout dev"
    exit 1
fi

# Verificar se foi fornecida uma mensagem de commit
if [ -z "$1" ]; then
    echo "❌ Erro: Forneça uma mensagem para o commit."
    echo "   Uso: ./update_github.sh \"feat: minha mensagem\""
    echo ""
    echo "   Prefixos válidos: feat:, fix:, refactor:, docs:, style:, chore:"
    exit 1
fi

# Verificar se há mudanças para commitar
if git diff --quiet && git diff --cached --quiet; then
    echo "⚠️  Nenhuma mudança detectada para commitar."
    exit 0
fi

# Executar comandos do Git
echo "📦 Adicionando arquivos modificados..."
git add -A

echo "💾 Commitando na branch '$CURRENT_BRANCH': '$1'..."
git commit -m "$1"

echo "🚀 Enviando para o GitHub (branch: $CURRENT_BRANCH)..."
git push -u origin "$CURRENT_BRANCH"

echo "✅ Push concluído na branch '$CURRENT_BRANCH'!"
echo ""
echo "📋 Próximos passos:"
echo "   - Para merge em dev: git checkout dev && git merge $CURRENT_BRANCH"
echo "   - Para PR no GitHub: abra um Pull Request de '$CURRENT_BRANCH' → dev"
