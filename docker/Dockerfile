FROM node:18-alpine

# Variables d'environnement
ENV NODE_ENV=development
ENV PORT=3000

# Installer Pandoc pour l'export PDF (requis par le service export)
RUN apk add --no-cache pandoc curl

# Créer l'utilisateur non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# Répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./
COPY prisma ./prisma/

# Installer les dépendances
RUN npm ci

# Copier le code source
COPY . .

# Générer le client Prisma
RUN npx prisma generate

# Build de l'application
RUN npm run build

# Changer vers l'utilisateur non-root
USER nestjs

# Exposer le port
EXPOSE 3000

# Health check simple
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Démarrer l'application
CMD ["npm", "run", "start:prod"]