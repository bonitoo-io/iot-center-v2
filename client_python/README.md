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

## License

The project is under the [MIT License](https://opensource.org/licenses/MIT).
