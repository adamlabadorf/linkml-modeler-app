FROM node:20-alpine
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

ENV PORT=9999
EXPOSE 9999

CMD ["node", "server.js"]
