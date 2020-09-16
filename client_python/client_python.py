"""This code shows how to bootstrap your Python IoT device by IoT Center and push metrics into InfluxDB."""
import atexit
import itertools
import json
import os
import time
import uuid
from datetime import datetime
from typing import Optional

import urllib3
from influxdb_client import InfluxDBClient, WriteApi, Point
from influxdb_client.client.write_api import SYNCHRONOUS

"""
Global variables:
"""
http = urllib3.PoolManager()
influxdb_client = None  # type: Optional[InfluxDBClient]
write_api = None  # type: Optional[WriteApi]
config = None  # type: Optional[dict]
config_received = None  # type: Optional[datetime]


class HTTPError(Exception):
    """Exception raised for HTTP errors."""

    def __init__(self, response: urllib3.HTTPResponse):
        """
        Initialize HTTPError by HTTP response.

        :param response: HTTP response
        """
        super().__init__(f'({response.status}) Reason: {response.reason}')
        self.response = response


def setup() -> None:
    """
    Setup configuration from IoT Center.

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
    device_id = os.getenv("DEVICE_ID", uuid.uuid1())
    if config:
        device_id = config['id']

    # Request to configuration
    response = http.request('GET', f'{iot_center_url}/api/env/{device_id}')
    if not 200 <= response.status <= 299:
        raise HTTPError(response)
    config_fresh = json.loads(response.data.decode('utf-8'))

    if not config and config_fresh != config:
        config = config_fresh
        config_received = datetime.utcnow()
        influxdb_client = InfluxDBClient(url=config['influx_url'],
                                         token=config['influx_token'],
                                         org=config['influx_org'])
        write_api = influxdb_client.write_api(write_options=SYNCHRONOUS)
        print(f'Received configuration: {json.dumps(config, indent=4, sort_keys=False)}')


def write() -> None:
    point = Point("environment") \
        .tag("clientId", config['id']) \
        .tag("device", "?") \
        .tag("sensor", "?") \
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

    for index in itertools.count(1):
        # retrieve or reload configuration from IoT Center
        setup()
        # write data
        write()
        # wait to next iteration
        time.sleep(config['measurement_interval'])
