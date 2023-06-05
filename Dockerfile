FROM node:20

WORKDIR /usr/src/app
COPY package.json ./
COPY yarn.lock ./

RUN yarn install
COPY . .

EXPOSE 9001
CMD ["yarn", "run" , "start"]