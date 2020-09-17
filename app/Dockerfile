FROM node:12-alpine

RUN mkdir -p /home/node/app
WORKDIR /home/node/app

COPY . .

RUN yarn install
RUN yarn build

EXPOSE 5000
CMD [ "yarn", "start" ]