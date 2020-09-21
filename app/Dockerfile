#
# Build image
#
FROM node:12-alpine AS BUILD_IMAGE

RUN mkdir -p /home/iot-center
WORKDIR /home/iot-center

COPY . .

# Install dependencies & build application
RUN yarn install --frozen-lockfile
RUN yarn build

# Build binary
#   - full list of targets: https://github.com/nexe/nexe/releases
RUN npm i nexe -g
RUN nexe -t alpine-x86-12.10.0 -o server.bin -i server

#
# Runtime image
#
FROM alpine:3.7

ENV NODE_ENV=production

RUN mkdir -p /home/iot-center/
WORKDIR /home/iot-center/

COPY --from=BUILD_IMAGE /home/iot-center/server.bin .
COPY --from=BUILD_IMAGE /home/iot-center/ui/build/ /home/iot-center/ui/build/

EXPOSE 5000
CMD [ "/home/iot-center/server.bin" ]
