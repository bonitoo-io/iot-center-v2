import React, {useState, useEffect, FunctionComponent} from 'react'
import {InfluxDB, flux, Point} from '@influxdata/influxdb-client'
import {Tooltip, Button, Progress, notification} from 'antd'
import {RouteComponentProps} from 'react-router-dom'

import PageContent, {Message} from './PageContent'
import {
  generateTemperature,
  generateHumidity,
  generatePressure,
  generateCO2,
  generateTVOC,
  fetchGPXData,
  generateGPXData,
} from '../util/generateValue'
import {InfoCircleFilled} from '@ant-design/icons'
import Table, {ColumnsType} from 'antd/lib/table'
import {colorLink} from '../styles/colors'
import {Title} from '../util/Antd.utils'
import {GridDescription} from '../util/GridDescription'
import {IconDashboard, IconRefresh, IconWriteData} from '../styles/icons'

interface DeviceConfig {
  influx_url: string
  influx_org: string
  influx_token: string
  influx_bucket: string
  id: string
  default_lat?: number
  default_lon?: number
  write_endpoint?: string
  createdAt: string
}
interface measurementSummaryRow {
  _field: string
  minValue: number
  maxValue: number
  maxTime: string
  count: string
  sensor: string
}
interface DeviceData {
  config: DeviceConfig
  measurements: measurementSummaryRow[]
}
type ProgressFn = (percent: number, current: number, total: number) => void
const VIRTUAL_DEVICE = 'virtual_device'

async function fetchDeviceConfig(deviceId: string): Promise<DeviceConfig> {
  const response = await fetch(
    `/api/env/${deviceId}?register=${deviceId === VIRTUAL_DEVICE}`
  )
  if (response.status >= 300) {
    const text = await response.text()
    throw new Error(`${response.status} ${text}`)
  }
  const deviceConfig: DeviceConfig = await response.json()
  if (!deviceConfig.influx_token) {
    throw new Error(`Device '${deviceId}' is not authorized!`)
  }
  return deviceConfig
}

async function fetchDeviceData(config: DeviceConfig): Promise<DeviceData> {
  const {
    // influx_url: url, // use '/influx' proxy to avoid problem with InfluxDB v2 Beta (Docker)
    influx_token: token,
    influx_org: org,
    influx_bucket: bucket,
    id,
  } = config
  const influxDB = new InfluxDB({url: '/influx', token})
  const queryApi = influxDB.getQueryApi(org)
  // query data from influxdb
  const [measurements, sensors]: [
    measurementSummaryRow[],
    {[key: string]: string}[]
  ] = await Promise.all([
    queryApi.collectRows<any>(flux`
  import "math"
from(bucket: ${bucket})
  |> range(start: -30d)
  |> filter(fn: (r) => r._measurement == "environment")
  |> filter(fn: (r) => r.clientId == ${id})
  |> filter(fn: (r) => r._field != "s2_cell_id")
  |> toFloat()
  |> group(columns: ["_field"])
  |> reduce(
      fn: (r, accumulator) => ({
        maxTime: (if r._time>accumulator.maxTime then r._time else accumulator.maxTime),
        maxValue: (if r._value>accumulator.maxValue then r._value else accumulator.maxValue),
        minValue: (if r._value<accumulator.minValue then r._value else accumulator.minValue),
        count: accumulator.count + 1.0
      }),
      identity: {maxTime: 1970-01-01, count: 0.0, minValue: math.mInf(sign: 1), maxValue: math.mInf(sign: -1)}
  )`),
    queryApi.collectRows<any>(flux`
from(bucket: ${bucket})
  |> range(start: -30d)
  |> filter(fn: (r) => r._measurement == "environment")
  |> filter(fn: (r) => r.clientId == ${id})
  |> keep(columns: ["TemperatureSensor", "HumiditySensor", "PressureSensor", "CO2Sensor", "TVOCSensor", "GPSSensor", "_time"])
  |> map(fn: (r) => ({r with _value: 0}))
  |> last()
    `),
  ])
  measurements.forEach((x) => {
    const {_field} = x
    const senosorTagName =
      (_field === 'Lat' || _field === 'Lon' ? 'GPS' : _field) + 'Sensor'
    x.sensor = sensors?.[0]?.[senosorTagName] ?? ''
  })
  return {config, measurements}
}

async function writeEmulatedData(
  state: DeviceData,
  onProgress: ProgressFn
): Promise<number> {
  const {
    // influx_url: url, // use '/influx' proxy to avoid problems with InfluxDB v2 Beta (Docker)
    influx_token: token,
    influx_org: org,
    influx_bucket: bucket,
    write_endpoint,
    id,
  } = state.config
  // calculate window to emulate writes
  const toTime = Math.trunc(Date.now() / 60_000) * 60_000
  let lastTime = state.measurements[0]?.maxTime
    ? Math.trunc(Date.parse(state.measurements[0].maxTime) / 60_000) * 60_000
    : 0
  if (lastTime < toTime - 7 * 24 * 60 * 60 * 1000) {
    lastTime = toTime - 7 * 24 * 60 * 60 * 1000
  }
  const getGPX = generateGPXData.bind(undefined, await fetchGPXData())
  const totalPoints = Math.trunc((toTime - lastTime) / 60_000)
  let pointsWritten = 0
  if (totalPoints > 0) {
    const batchSize = 2000
    const url = write_endpoint ? write_endpoint : '/influx'
    const influxDB = new InfluxDB({url, token})
    const writeApi = influxDB.getWriteApi(org, bucket, 'ns', {
      batchSize: batchSize + 1,
      defaultTags: {clientId: id},
    })
    try {
      // write random temperatures
      const point = new Point('environment') // reuse the same point to spare memory
      onProgress(0, 0, totalPoints)
      while (lastTime < toTime) {
        lastTime += 60_000 // emulate next minute
        const gpx = getGPX(lastTime)
        point
          .floatField('Temperature', generateTemperature(lastTime))
          .floatField('Humidity', generateHumidity(lastTime))
          .floatField('Pressure', generatePressure(lastTime))
          .intField('CO2', generateCO2(lastTime))
          .intField('TVOC', generateTVOC(lastTime))
          .floatField('Lat', gpx[0] || state.config.default_lat || 50.0873254)
          .floatField('Lon', gpx[1] || state.config.default_lon || 14.4071543)
          .tag('TemperatureSensor', 'virtual_TemperatureSensor')
          .tag('HumiditySensor', 'virtual_HumiditySensor')
          .tag('PressureSensor', 'virtual_PressureSensor')
          .tag('CO2Sensor', 'virtual_CO2Sensor')
          .tag('TVOCSensor', 'virtual_TVOCSensor')
          .tag('GPSSensor', 'virtual_GPSSensor')
          .timestamp(String(lastTime) + '000000')
        writeApi.writePoint(point)

        pointsWritten++
        if (pointsWritten % batchSize === 0) {
          await writeApi.flush()
          onProgress(
            (pointsWritten / totalPoints) * 100,
            pointsWritten,
            totalPoints
          )
        }
      }
      await writeApi.flush()
    } finally {
      await writeApi.close()
    }
    onProgress(100, pointsWritten, totalPoints)
  }

  return pointsWritten
}

interface PropsRoute {
  deviceId?: string
}

interface Props {
  helpCollapsed: boolean
}

const DevicePage: FunctionComponent<
  RouteComponentProps<PropsRoute> & Props
> = ({match, location, helpCollapsed}) => {
  const deviceId = match.params.deviceId ?? VIRTUAL_DEVICE
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<Message | undefined>()
  const [deviceData, setDeviceData] = useState<DeviceData | undefined>()
  const [dataStamp, setDataStamp] = useState(0)
  const [progress, setProgress] = useState(-1)
  const writeAllowed =
    deviceId === VIRTUAL_DEVICE ||
    new URLSearchParams(location.search).get('write') === 'true'

  const isVirtualDevice = deviceId === VIRTUAL_DEVICE

  // fetch device configuration and data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const deviceConfig = await fetchDeviceConfig(deviceId)
        setDeviceData(await fetchDeviceData(deviceConfig))
      } catch (e) {
        console.error(e)
        setMessage({
          title: 'Cannot load device data',
          description: String(e),
          type: 'error',
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [dataStamp, deviceId])

  async function writeData() {
    const onProgress: ProgressFn = (percent /*, current, total */) => {
      // console.log(
      //   `writeData ${current}/${total} (${Math.trunc(percent * 100) / 100}%)`
      // );
      setProgress(percent)
    }
    try {
      const count = await writeEmulatedData(
        deviceData as DeviceData,
        onProgress
      )
      if (count) {
        notification.success({
          message: (
            <>
              <b>{count}</b> measurement point{count > 1 ? 's were' : ' was'}{' '}
              written to InfluxDB.
            </>
          ),
        })
        setDataStamp(dataStamp + 1) // reload device data
      } else {
        notification.info({
          message: `No new data were written to InfluxDB, the current measurement is already written.`,
        })
      }
    } catch (e) {
      console.error(e)
      setMessage({
        title: 'Cannot write data',
        description: String(e),
        type: 'error',
      })
    } finally {
      setProgress(-1)
    }
  }

  const writeButtonDisabled = progress !== -1 || loading
  const pageControls = (
    <>
      {writeAllowed ? (
        <Tooltip title="Write Missing Data for the last 7 days" placement="top">
          <Button
            onClick={writeData}
            disabled={writeButtonDisabled}
            icon={<IconWriteData />}
          />
        </Tooltip>
      ) : undefined}
      <Tooltip title="Reload" placement="topRight">
        <Button
          disabled={loading}
          loading={loading}
          onClick={() => setDataStamp(dataStamp + 1)}
          icon={<IconRefresh />}
        />
      </Tooltip>
      <Tooltip title="Go to device dashboard" placement="topRight">
        <Button
          type="primary"
          icon={<IconDashboard />}
          href={`/dashboard/${deviceId}`}
        ></Button>
      </Tooltip>
    </>
  )

  const columnDefinitions: ColumnsType<measurementSummaryRow> = [
    {
      title: 'Field',
      dataIndex: '_field',
    },
    {
      title: 'min',
      dataIndex: 'minValue',
      render: (val: number) => +val.toFixed(2),
      align: 'right',
    },
    {
      title: 'max',
      dataIndex: 'maxValue',
      render: (val: number) => +val.toFixed(2),
      align: 'right',
    },
    {
      title: 'max time',
      dataIndex: 'maxTime',
    },
    {
      title: 'entry count',
      dataIndex: 'count',
      align: 'right',
    },
    {
      title: 'sensor',
      dataIndex: 'sensor',
    },
  ]

  return (
    <PageContent
      title={
        isVirtualDevice ? (
          <>
            {'Virtual Device'}
            <Tooltip title="This page writes temperature measurements for the last 7 days from an emulated device, the temperature is reported every minute.">
              <InfoCircleFilled style={{fontSize: '1em', marginLeft: 5}} />
            </Tooltip>
          </>
        ) : (
          `Device ${deviceId}`
        )
      }
      message={message}
      spin={loading}
      titleExtra={pageControls}
    >
      {deviceId === VIRTUAL_DEVICE ? (
        <>
          <div style={{visibility: progress >= 0 ? 'visible' : 'hidden'}}>
            <Progress
              percent={progress >= 0 ? Math.trunc(progress) : 0}
              strokeColor={colorLink}
            />
          </div>
        </>
      ) : undefined}
      <GridDescription
        title="Device Configuration"
        column={
          helpCollapsed ? {xxl: 3, xl: 2, md: 1, sm: 1} : {xxl: 2, md: 1, sm: 1}
        }
        descriptions={[
          {
            label: 'Device ID',
            value: deviceData?.config.id,
          },
          {
            label: 'Registration Time',
            value: deviceData?.config.createdAt,
          },
          {
            label: 'InfluxDB URL',
            value: deviceData?.config.influx_url,
          },
          {
            label: 'InfluxDB Organization',
            value: deviceData?.config.influx_org,
          },
          {
            label: 'InfluxDB Bucket',
            value: deviceData?.config.influx_bucket,
          },
          {
            label: 'InfluxDB Token',
            value: deviceData?.config.influx_token ? '***' : 'N/A',
          },
        ]}
      />
      <Title>Measurements</Title>
      <Table
        dataSource={deviceData?.measurements}
        columns={columnDefinitions}
        pagination={false}
      />
    </PageContent>
  )
}

export default DevicePage
