## Virtual Device page

[_Source code for this page on GitHub_](https://github.com/bonitoo-io/iot-center-v2/blob/master/app/ui/src/pages/DevicePage.tsx)

The virtual device emulates a real device, generating examples data so that we can use IoT Center without needing a real device.
It writes measurements for every minute in the last 7 days.
It can also generate and send temperature, humidity, pressure, CO2, TVOC, latitude, and longitude measurements.
(See [`writeEmulatedData`](https://github.com/bonitoo-io/iot-center-v2/blob/84a35d903f73c8c609f6c7d7ddc50f8342895685/app/ui/src/pages/DevicePage.tsx#L123-L194) in the source code.)

The “device” is a piece of code that runs in the browser.
It uses the [influxdb-client-js] library.
It gets the configuration of how to communicate with InfluxDB (URL, organization, bucket, token) from IoT center.

For more, see the [_InfluxDB IoT dev guide_](https://influxdata.github.io/iot-dev-guide/ui/virtual-device.html).
