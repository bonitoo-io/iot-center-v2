# IoT Center v2

This repository contains the IoT Center application that provides a web UI that shows how to use InfluxDB v2 in various use cases. 
It also contains independent clients that write into InfluxDB.

## Features

ToDo https://gitlab.com/bonitoo-io/influxdata/-/blob/master/iot-center/TechnicalSkeleton.MD

## Quick Start

* Prerequisites
   * node 12 or newer
   * yarn 1.9.4 or newer

### Run IoT Center Application

```
cd app
yarn install
yarn build
yarn start
open http://localhost:5000
```

or

```
docker-compose up
open http://localhost:5000
```

### Develop and Play with IoT Center Application (hot-swap enabled)

```
cd app
yarn install
yarn dev
```

## License

The project is under the [MIT License](https://opensource.org/licenses/MIT).
