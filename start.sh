#!/bin/bash

echo "=== Installation des dépendances ==="
npm install

echo ""
echo "=== Génération du client Prisma ==="
npx prisma generate

echo ""
echo "=== Application des migrations Prisma ==="
npx prisma migrate deploy

echo ""
echo "=== Démarrage du serveur ==="
npm run start