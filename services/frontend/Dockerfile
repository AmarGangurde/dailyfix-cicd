FROM node:20-alpine as build
WORKDIR /ui
COPY . .
RUN npm install && npm run build

FROM nginx:alpine
COPY --from=build /ui/dist /usr/share/nginx/html
