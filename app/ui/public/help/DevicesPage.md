## Device Registration page

[_Source code for this page on GitHub_](https://github.com/bonitoo-io/iot-center-v2/blob/master/app/ui/src/pages/DevicesPage.tsx)

### Example: creating an authorization

Through an API endpoint at `/api/env/<deviceID>`, the **Register** button on this page
ultimately calls a function called [`createIoTAuthorization`](https://github.com/bonitoo-io/iot-center-v2/blob/3ecaabe1b46341a4752e19eaff0a08b8021ab7a7/app/server/influxdb/authorizations.js#L70-L95).
This function uses the [`influxdata/influxdb-client-apis`](https://influxdata.github.io/influxdb-client-js/influxdb-client-apis.html) package.
It calls the InfluxDB API and requests a new token with specified permissions:

```js
return await authorizationsAPI.postAuthorizations({
  body: {
    orgID,
    description: DESC_PREFIX + deviceId,
    permissions: [
      {
        action: 'read',
        resource: {type: 'buckets', id: bucketID, orgID},
      },
      {
        action: 'write',
        resource: {type: 'buckets', id: bucketID, orgID},
      },
    ],
  },
})
```

For more, see the [_InfluxDB IoT dev guide_](https://influxdata.github.io/iot-dev-guide/ui/device-registration.html).
