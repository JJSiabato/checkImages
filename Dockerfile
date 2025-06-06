FROM node:18

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

# Construir la aplicación
RUN yarn build

RUN yarn install --production --frozen-lockfile && yarn cache clean

EXPOSE 3000

CMD ["node", "dist/index.js"]