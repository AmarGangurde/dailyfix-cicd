FROM node:20-alpine
WORKDIR /worker
COPY . .
RUN npm install
CMD ["node", "src/worker.js"]
