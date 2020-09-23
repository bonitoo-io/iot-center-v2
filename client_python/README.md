# IoT Center v2 - Python Client

The `client_python.py` shows how to bootstrap your Python IoT device by IoT Center and push metrics into InfluxDB.

## Quick Start

### Prerequisites

* Python 3.6 or newer

### Configuration

The `client_python.py` could be configured via environment variables:

| Name | Description | Default value |
|---|---|---|
| IOT_CENTER_URL | IoT Center URL | http://localhost:5000|
| IOT_DEVICE_ID | Used to identify client to the IoT Center [required] | none |

### Run Python Client

```
pip install influxdb-client

export IOT_DEVICE_ID=my-id
python client_python.py 
```

### bme280

The `client_python.py` is also able to measure temperature, atmospheric pressure and humidity from `bme280` sensor.
Just install `bmp_sensors` package by `pip install bmp_sensors` and client will be produces measured `Temperature`, `Humidity` and `Pressure`.

### geo

The geo data are provide by: https://freegeoip.app/json/.

### Measurement Schema

- environment
    - Tags
        - clientId
        - device
        - sensor
    - Fields
        - Temperature
        - Humidity
        - Pressure
        - Lat
        - Lon

#### Example Output:

```
environment,clientId=my-id,device=raspberrypi,sensor=bme280 Humidity=62.36,Lat=50.126144,Lon=14.504621,Pressure=983.72,Temperature=10.21 1600338450566582016
```

## License

The project is under the [MIT License](https://opensource.org/licenses/MIT).
