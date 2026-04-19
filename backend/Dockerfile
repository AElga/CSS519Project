FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY backend ./backend

EXPOSE 3000

CMD ["sh", "-c", "node backend/init-db.js && node backend/server.js"]
