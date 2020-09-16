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

"""
Global variables:
"""
http = urllib3.PoolManager()
influxdb_client = None  # type: Optional[InfluxDBClient]
write_api = None  # type: Optional[WriteApi]
config = None  # type: Optional[dict]
config_received = None  # type: Optional[datetime]


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
    response = http.request('GET', f'{iot_center_url}/api/env/{iot_device_id}')
    if not 200 <= response.status <= 299:
        raise Exception(f'[HTTP - {response.status}]: {response.reason}')
    config_fresh = json.loads(response.data.decode('utf-8'))

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
    point = Point("environment") \
        .tag("clientId", config['id']) \
        .tag("device", "raspberrypi") \
        .tag("sensor", "bme280") \
        .field("Temperature", 10.21) \
        .field("Humidity", 62.36) \
        .field("Pressure", 983.72) \
        .field("CO2", 1337) \
        .field("TVOC", 28425) \
        .field("Lat", 50.126144) \
        .field("Lon", 14.504621) \
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
