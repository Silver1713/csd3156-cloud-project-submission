FROM node:22-alpine

WORKDIR /app

ENV PORT=3000

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY public ./public
COPY src ./src

RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "echo Backend starting on port ${PORT} && npm run start"]
