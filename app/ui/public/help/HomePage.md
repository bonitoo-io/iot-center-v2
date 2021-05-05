# Welcome to IoT Center!

The _IoT Center_ is designed for demonstration purposes.
For an in depth look, see the [_InfluxDB IoT dev guide_](__DEV_GUIDE__).

The _Iot Center_ application manages IoT devices that write data into InfluxDB.
IoT Center shows connected devices and measured values from InfluxDB in custom dashboards.
It is designed to demonstrate one possible application architecture for a web app using InfluxDB and IoT clients.

Each IoT device measures temperature.
Depending on the connected sensors, it can provide additional measurements like humidity, pressure, and CO2 concentration.
Each device can either provide static GPS coordinates or actual coordinates from a connected GPS module.
