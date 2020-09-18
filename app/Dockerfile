#
# Build image
#
FROM node:12-alpine AS BUILD_IMAGE

RUN mkdir -p /home/node/app
WORKDIR /home/node/app

COPY . .

# install dependencies & build application
RUN yarn install --frozen-lockfile
RUN yarn build

# remove development dependencies & run node prune
RUN npm prune --production

#
# Runtime image
#
FROM node:12-alpine

ENV NODE_ENV=production

RUN mkdir -p /home/node/app
WORKDIR /home/node/app

COPY --from=BUILD_IMAGE /home/node/app .
RUN yarn install --frozen-lockfile --production=true

RUN yarn autoclean --init
RUN yarn autoclean --force

EXPOSE 5000
CMD [ "yarn", "start" ]
