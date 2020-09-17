"""This code shows how to bootstrap your Python IoT device by IoT Center and push metrics into InfluxDB."""
import atexit
import itertools
import json
import os
import time
from datetime import datetime
from typing import Optional

import urllib3
from influxdb_client import InfluxDBClient, WriteApi, Point, WriteOptions


class Sensor:
    """Sensor to provide information about Temperature, Humidity, Pressure, ..."""

    def __init__(self):
        """Initialize bme280 sensor."""
        try:
            import bmp_sensors as Sensors
            self._bme280 = Sensors.BME280(1, False)
        except ModuleNotFoundError:
            self._bme280 = None

    def temperature(self) -> float:
        """
        Get temperature from bme280 or default value 10.21.

        :return: Returns temperature as a :class:`float` object
        """
        if self._bme280:
            return self._bme280.MeasureTemperature()
        return 10.21

    def humidity(self) -> float:
        """
        Get humidity from bme280 or default value 62.36.

        :return: Returns humidity as a :class:`float` object
        """
        if self._bme280:
            return self._bme280.MeasureHumidity()
        return 62.36

    def pressure(self) -> float:
        """
        Get pressure from bme280 or default value 983.72.

        :return: Returns pressure as a :class:`float` object
        """
        if self._bme280:
            return self._bme280.MeasurePressure()
        return 983.72

    def geo(self):
        """
        Get GEO location from https://freegeoip.app/json/'.

        :return: Returns a dictionary with `latitude` and `longitude` key.
        """
        try:
            return fetch_json('https://freegeoip.app/json/')
        except Exception:
            return {
                'latitude': config['default_lat'] if config else 50.126144,
                'longitude': config['default_lon'] if config else 14.50462, }


"""
Global variables:
"""
http = urllib3.PoolManager()
sensor = Sensor()
influxdb_client = None  # type: Optional[InfluxDBClient]
write_api = None  # type: Optional[WriteApi]
config = None  # type: Optional[dict]
config_received = None  # type: Optional[datetime]


def fetch_json(url):
    """Fetch JSON from url."""
    response = http.request('GET', url)
    if not 200 <= response.status <= 299:
        raise Exception(f'[HTTP - {response.status}]: {response.reason}')
    config_fresh = json.loads(response.data.decode('utf-8'))
    return config_fresh


def configure() -> None:
    """
    Retrieve or refresh a configuration from IoT Center.

    Successful configuration is set as a global IOT_CONFIGURATION dictionary with following properties:
        * id
        * influx_url
        * influx_org
        * influx_token
        * influx_bucket
        * configuration_refresh
        * default_lon
        * default_lat
        * measurement_interval
    """
    global config
    global config_received
    global influxdb_client
    global write_api

    # Check freshness of configuration
    if config_received and (datetime.utcnow() - config_received).total_seconds() < config['configuration_refresh']:
        pass

    iot_center_url = os.getenv("IOT_CENTER_URL", "http://localhost:5000")
    iot_device_id = os.getenv("IOT_DEVICE_ID")

    # Request to configuration
    config_fresh = fetch_json(f'{iot_center_url}/api/env/{iot_device_id}')

    # New or changed configuration
    if not config and config_fresh != config:
        config = config_fresh
        config_received = datetime.utcnow()
        influxdb_client = InfluxDBClient(url=config['influx_url'],
                                         token=config['influx_token'],
                                         org=config['influx_org'])
        write_api = influxdb_client.write_api(write_options=WriteOptions(batch_size=1))
        print(f'Received configuration: {json.dumps(config, indent=4, sort_keys=False)}')


def write() -> None:
    """Write point into InfluxDB."""
    geo = sensor.geo()
    point = Point("environment") \
        .tag("clientId", config['id']) \
        .tag("device", "raspberrypi") \
        .tag("sensor", "bme280") \
        .field("Temperature", sensor.temperature()) \
        .field("Humidity", sensor.humidity()) \
        .field("Pressure", sensor.pressure()) \
        .field("CO2", 1337) \
        .field("TVOC", 28425) \
        .field("Lat", geo['latitude']) \
        .field("Lon", geo['longitude']) \
        .time(datetime.utcnow())

    print(f"Writing: {point.to_line_protocol()}")
    write_api.write(bucket=config['influx_bucket'], record=point)


def on_exit():
    """Close InfluxDBClient and clear HTTP connection pool."""
    if influxdb_client:
        influxdb_client.__del__()
    if http:
        http.clear()


if __name__ == '__main__':

    # Call after terminate a script
    atexit.register(on_exit)

    if not os.getenv("IOT_DEVICE_ID"):
        raise ValueError("The IOT_DEVICE_ID env variable should be defined. Set env by: 'export IOT_DEVICE_ID=my-id'.")

    for index in itertools.count(1):
        # Retrieve or reload configuration from IoT Center
        try:
            configure()
        except Exception as err:
            print(f"Configuration failed: {err}")

        # Write data
        if config:
            write()

        # Wait to next iteration
        time.sleep(config['measurement_interval'] if config else 10)
