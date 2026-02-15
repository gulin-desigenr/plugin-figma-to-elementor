#!/bin/bash

# Verificar se foi fornecida uma mensagem de commit
if [ -z "$1" ]
then
    echo "Erro: Por favor, forneça uma mensagem para a atualização."
    echo "Uso: ./update_github.sh \"Minha mensagem de atualização\""
    exit 1
fi

# Executar comandos do Git
echo "📦 Adicionando arquivos..."
git add .

echo "💾 Salvando versão: '$1'..."
git commit -m "$1"

echo "🚀 Enviando para o GitHub..."
git push

echo "✅ Atualização concluída com sucesso!"
