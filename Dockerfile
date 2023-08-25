FROM node:18

WORKDIR /usr/src/app
COPY package.json ./
COPY yarn.lock ./

RUN yarn install
COPY . .
RUN yarn build

EXPOSE 9001
CMD ["yarn", "start"]