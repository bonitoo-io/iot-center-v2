import React, {useState, useEffect, FunctionComponent} from 'react'
import {
  Tooltip,
  Button,
  Card,
  Row,
  Col,
  Collapse,
  Empty,
  Select,
  Divider,
} from 'antd'
import {RouteComponentProps} from 'react-router-dom'

import PageContent, {Message} from './PageContent'
import {
  Plot,
  timeFormatter,
  Table as GiraffeTable,
  GAUGE_THEME_LIGHT,
  GaugeLayerConfig,
  LineLayerConfig,
} from '@influxdata/giraffe'
import {
  SettingFilled,
  ReloadOutlined,
  InfoCircleFilled,
} from '@ant-design/icons'
import CollapsePanel from 'antd/lib/collapse/CollapsePanel'
import {DeviceInfo} from './DevicesPage'
import {getXDomainFromTable} from '../util/tableUtils'
import {flux, fluxDuration, InfluxDB} from '@influxdata/influxdb-client'
import {queryTable} from '../util/queryTable'
import {VIRTUAL_DEVICE} from '../App'

import {MapContainer, TileLayer} from 'react-leaflet'
import AntPathWrapper from '../util/antPathWrapper'

interface DeviceConfig {
  influx_url: string
  influx_org: string
  influx_token: string
  influx_bucket: string
  id: string
}

interface DeviceData {
  config: DeviceConfig
  measurementsTable?: GiraffeTable
  measurementsLastValues?: {column: string; table: GiraffeTable}[]
}

const fetchDeviceConfig = async (deviceId: string): Promise<DeviceConfig> => {
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

const fetchDeviceMeasurements = async (
  config: DeviceConfig,
  timeStart = '-30d'
): Promise<GiraffeTable> => {
  const {
    // influx_url: url, // use '/influx' proxy to avoid problem with InfluxDB v2 Beta (Docker)
    influx_token: token,
    influx_org: org,
    influx_bucket: bucket,
    id,
  } = config
  const queryApi = new InfluxDB({url: '/influx', token}).getQueryApi(org)
  const result = await queryTable(
    queryApi,
    flux`
  import "influxdata/influxdb/v1"    
  from(bucket: ${bucket})
    |> range(start: ${fluxDuration(timeStart)})
    |> filter(fn: (r) => r._measurement == "environment")
    |> filter(fn: (r) => r["_field"] == "Temperature" or r["_field"] == "TVOC" or r["_field"] == "Pressure" or r["_field"] == "Humidity" or r["_field"] == "CO2" or r["_field"] == "Lat" or r["_field"] == "Lon")
    |> filter(fn: (r) => r.clientId == ${id})
    |> v1.fieldsAsCols()`
  )
  return result
}

const fetchDeviceDataFieldLast = async (
  config: DeviceConfig,
  field: string,
  maxPastTime = '-1m'
): Promise<GiraffeTable> => {
  const {
    // influx_url: url, // use '/influx' proxy to avoid problem with InfluxDB v2 Beta (Docker)
    influx_token: token,
    influx_org: org,
    influx_bucket: bucket,
    id,
  } = config
  const queryApi = new InfluxDB({url: '/influx', token}).getQueryApi(org)
  const result = await queryTable(
    queryApi,
    flux`
  import "influxdata/influxdb/v1"
  from(bucket: ${bucket})
    |> range(start: ${fluxDuration(maxPastTime)})
    |> filter(fn: (r) => r.clientId == ${id})
    |> filter(fn: (r) => r._measurement == "environment")
    |> filter(fn: (r) => r["_field"] == ${field})
    |> keep(columns: ["_value", "_time"])
    |> last()`
  )
  return result
}

type TMeasurementDefinition = {
  title: string
  column: string
  gauge: Partial<GaugeLayerConfig>
  line?: Partial<LineLayerConfig>
}
const measurementsDefinitions: TMeasurementDefinition[] = [
  {
    title: 'Temperature',
    column: 'Temperature',
    gauge: {
      suffix: ' °C',
      tickSuffix: ' °C',
      gaugeColors: [
        {id: 'min', name: 'min', value: 0, hex: '#00aaff', type: 'min'},
        {id: 'max', name: 'max', value: 40, hex: '#ff6666', type: 'max'},
      ],
    },
  },
  {
    title: 'Humidity',
    column: 'Humidity',
    gauge: {
      suffix: ' %',
      tickSuffix: ' %',
      gaugeColors: [
        {id: 'min', name: 'min', value: 0, hex: '#ff6666', type: 'min'},
        {
          id: 'low-warn',
          name: 'low-warn',
          value: 30,
          hex: '#e8e800',
          type: 'threshold',
        },
        {
          id: 'ideal',
          name: 'ideal',
          value: 40,
          hex: '#00dd00',
          type: 'threshold',
        },
        {
          id: 'high-warn',
          name: 'high-warn',
          value: 60,
          hex: '#e8e800',
          type: 'threshold',
        },
        {
          id: 'high-warn',
          name: 'high-warn',
          value: 70,
          hex: '#ff6666',
          type: 'threshold',
        },
        {id: 'max', name: 'max', value: 100, hex: '', type: 'max'},
      ],
    },
  },
  {
    title: 'Pressure',
    column: 'Pressure',
    gauge: {
      suffix: ' hPa',
      tickSuffix: ' hPa',
      decimalPlaces: {digits: 0, isEnforced: true},
      gaugeColors: [
        {id: 'min', name: 'min', value: 970, hex: '#00ffff', type: 'min'},
        {id: 'max', name: 'max', value: 1_050, hex: '#ff6666', type: 'max'},
      ],
    },
  },
  {
    title: 'CO2',
    column: 'CO2',
    gauge: {
      suffix: ' ppm',
      tickSuffix: ' ppm',
      decimalPlaces: {digits: 0, isEnforced: true},
      gaugeColors: [
        {id: 'min', name: 'min', value: 400, hex: '#00aaff', type: 'min'},
        {id: 'max', name: 'max', value: 3000, hex: '#ff6666', type: 'max'},
      ],
    },
  },
  {
    title: 'TVOC',
    column: 'TVOC',
    gauge: {
      suffix: ' ppm',
      tickSuffix: ' ppm',
      decimalPlaces: {digits: 0, isEnforced: true},
      gaugeColors: [
        {id: 'min', name: 'min', value: 250, hex: '#00aaff', type: 'min'},
        {id: 'max', name: 'max', value: 2000, hex: '#ff6666', type: 'max'},
      ],
    },
  },
]

interface PropsRoute {
  deviceId?: string
}

interface Props {
  helpCollapsed: boolean
}

const DashboardPage: FunctionComponent<
  RouteComponentProps<PropsRoute> & Props
> = ({match, history, helpCollapsed}) => {
  const deviceId = match.params.deviceId ?? VIRTUAL_DEVICE
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<Message | undefined>()
  const [deviceData, setDeviceData] = useState<DeviceData | undefined>()
  const [dataStamp, setDataStamp] = useState(0)
  const [devices, setDevices] = useState<DeviceInfo[] | undefined>(undefined)
  const [timeStart, setTimeStart] = useState('-1d')
  const [xDomain, setXDomain] = useState<number[] | undefined>(undefined)

  const resetXDomain = () =>
    setXDomain(getXDomainFromTable(deviceData?.measurementsTable))

  const isVirtualDevice = deviceId === VIRTUAL_DEVICE
  const measurementsTable = deviceData?.measurementsTable

  // fetch device configuration and data
  useEffect(() => {
    const fetchDeviceLastValues = async (
      config: DeviceConfig,
      timeStart: string
    ) => {
      return Promise.all(
        measurementsDefinitions.map(async ({column}) => ({
          column,
          table: await fetchDeviceDataFieldLast(config, column, timeStart),
        }))
      )
    }

    const fetchData = async () => {
      setLoading(true)
      try {
        const config = await fetchDeviceConfig(deviceId)
        const deviceData: DeviceData = {config}
        const [table, lastValues] = await Promise.all([
          fetchDeviceMeasurements(config, timeStart),
          fetchDeviceLastValues(config, timeStart),
        ])
        deviceData.measurementsTable = table
        deviceData.measurementsLastValues = lastValues
        setDeviceData(deviceData)
      } catch (e) {
        console.error(e)
        setMessage({
          title: 'Cannot load device data',
          description: String(e),
          type: 'error',
        })
      }
      setLoading(false)
    }

    fetchData()
  }, [dataStamp, deviceId, timeStart])

  useEffect(() => {
    resetXDomain()
    // eslint-disable-next-line
  }, [deviceData])

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await fetch('/api/devices')
        if (response.status >= 300) {
          const text = await response.text()
          throw new Error(`${response.status} ${text}`)
        }
        const data = await response.json()
        setDevices(data)
      } catch (e) {
        setMessage({
          title: 'Cannot fetch data',
          description: String(e),
          type: 'error',
        })
      }
    }

    fetchDevices()
  }, [])

  const renderGauge = (
    gaugeDefinition: Partial<GaugeLayerConfig>,
    table: GiraffeTable
  ) => {
    const gaugeDefaults: GaugeLayerConfig = {
      type: 'gauge',
      gaugeColors: [],
      gaugeSize: 4,
      gaugeTheme: {
        ...GAUGE_THEME_LIGHT,
        valuePositionYOffset: 1,
      },
    }

    return (
      <div style={{width: '100%', height: 150}}>
        <Plot
          config={{
            showAxes: false,
            layers: [{...gaugeDefaults, ...gaugeDefinition}],
            table,
          }}
        />
      </div>
    )
  }

  const GaugeTime = ({time}: {time: number}) => {
    const now = Date.now()
    const diff = now - time

    if (diff < 60_000) return <div style={{color: 'green'}}>just now</div>
    if (diff < 300_000)
      return <div style={{color: 'green'}}>less than 5 min ago</div>
    if (diff < 900_000)
      return <div style={{color: '#ffbb77'}}>more than 5 min ago</div>
    return <div style={{color: 'red'}}>long time ago</div>
  }

  const gaugeMissingValues: string[] = []
  const gauges = deviceData?.measurementsLastValues?.length ? (
    <>
      <Row gutter={[4, 8]}>
        {measurementsDefinitions.map(({gauge, title, column}) => {
          const lastValueTable = deviceData?.measurementsLastValues?.find(
            (x) => x.column === column
          )?.table

          if (!lastValueTable?.length) {
            gaugeMissingValues.push(title)
            return undefined
          }

          const [time] = lastValueTable.getColumn('_time') as number[]

          return (
            <Col
              sm={helpCollapsed ? 24 : 24}
              md={helpCollapsed ? 12 : 24}
              xl={helpCollapsed ? 6 : 12}
            >
              <Card
                title={title}
                extra={
                  <Tooltip title={new Date(time).toISOString()}>
                    <GaugeTime {...{time}} />
                  </Tooltip>
                }
              >
                {renderGauge(gauge, lastValueTable)}
              </Card>
            </Col>
          )
        })}
      </Row>
      <Divider style={{color: 'rgba(0, 0, 0, .2)'}} orientation="right">
        {gaugeMissingValues.length
          ? `Gauge missing values: ${gaugeMissingValues.join(', ')}`
          : undefined}
      </Divider>
    </>
  ) : undefined

  const geo =
    measurementsTable && measurementsTable?.length
      ? (() => {
          const latCol = measurementsTable.getColumn(
            'Lat',
            'number'
          ) as number[]
          const lonCol = measurementsTable.getColumn(
            'Lon',
            'number'
          ) as number[]

          const track: [number, number][] =
            !lonCol || !latCol
              ? []
              : latCol.map((lat: number, i: number) => {
                  const lon = lonCol[i]
                  return [lat, lon] as [number, number]
                })

          // Made from basic react-leaflet example https://react-leaflet.js.org/docs/start-setup
          return (
            <>
              <Row>
                <Col sm={24}>
                  <MapContainer
                    style={{width: '100%', height: '500px'}}
                    center={track[track.length - 1]}
                    zoom={6}
                    scrollWheelZoom={false}
                  >
                    <TileLayer
                      attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <AntPathWrapper
                      positions={track}
                      options={{
                        delay: 400,
                        dashArray: [10, 20],
                        weight: 5,
                        color: '#0000FF',
                        pulseColor: '#FFFFFF',
                        paused: false,
                        reverse: false,
                        hardwareAccelerated: true,
                      }}
                    />
                  </MapContainer>
                  <Divider />
                </Col>
              </Row>
            </>
          )
        })()
      : undefined

  const renderPlot = (
    lineDefinition: Partial<LineLayerConfig> | undefined,
    table: GiraffeTable,
    column: string
  ) => {
    const lineDefaults: LineLayerConfig = {
      type: 'line',
      x: '_time',
      y: column,
      interpolation: 'linear',
    }

    return (
      <div style={{width: '100%', height: 200}}>
        <Plot
          config={{
            xDomain: xDomain,
            onSetXDomain: setXDomain,
            onResetXDomain: resetXDomain,
            layers: [{...lineDefaults, ...lineDefinition}],
            table,
            valueFormatters: {
              _time: timeFormatter({
                timeZone: 'UTC',
                format: 'YYYY-MM-DD HH:mm:ss ZZ',
              }),
            },
          }}
        />
      </div>
    )
  }

  const plots =
    measurementsTable && measurementsTable?.length
      ? (() => {
          const measurementsWithValues = measurementsDefinitions.filter(
            ({column}) => measurementsTable.getColumn(column)
          )
          const measurementsNoValues = measurementsDefinitions.filter(
            ({column}) => !measurementsTable.getColumn(column)
          )

          return (
            <>
              <Collapse
                defaultActiveKey={measurementsWithValues.map((_, i) => i)}
              >
                {measurementsWithValues.map(({line, title, column}, i) => (
                  <CollapsePanel key={i} header={title}>
                    {renderPlot(line, measurementsTable, column)}
                  </CollapsePanel>
                ))}
              </Collapse>
              {measurementsNoValues.length ? (
                <Collapse>
                  {measurementsNoValues.map(({title}, i) => (
                    <CollapsePanel
                      key={i}
                      disabled={true}
                      header={`${title} - No data`}
                    />
                  ))}
                </Collapse>
              ) : undefined}
            </>
          )
        })()
      : undefined

  const timeOptions: {label: string; value: string}[] = [
    {label: 'Past 5m', value: '-5m'},
    {label: 'Past 15m', value: '-15m'},
    {label: 'Past 1h', value: '-1h'},
    {label: 'Past 6h', value: '-6h'},
    {label: 'Past 1d', value: '-1d'},
    {label: 'Past 3d', value: '-3d'},
    {label: 'Past 7d', value: '-7d'},
    {label: 'Past 30d', value: '-30d'},
  ]

  const pageControls = (
    <>
      <Tooltip title="Choose device" placement="left">
        <Select
          showSearch
          value={deviceId}
          placeholder={'select device to show'}
          showArrow={true}
          filterOption={true}
          onChange={(key) => history.push(`/dashboard/${key}`)}
          style={{minWidth: 200, width: 350}}
          loading={!devices}
          disabled={!devices}
        >
          {devices &&
            devices.map(({deviceId}) => (
              <Select.Option key={deviceId} value={deviceId}>
                {deviceId}
              </Select.Option>
            ))}
        </Select>
      </Tooltip>

      <Tooltip title="Choose time" placement="left">
        <Select
          value={timeStart}
          onChange={setTimeStart}
          style={{minWidth: 100}}
          loading={loading}
          disabled={loading}
        >
          {timeOptions.map(({label, value}) => (
            <Select.Option key={value} value={value}>
              {label}
            </Select.Option>
          ))}
        </Select>
      </Tooltip>

      <Tooltip title="Reload Device Data">
        <Button
          disabled={loading}
          loading={loading}
          onClick={() => setDataStamp(dataStamp + 1)}
          icon={<ReloadOutlined />}
        />
      </Tooltip>
      <Tooltip title="Go to device settings" placement="topRight">
        <Button
          type="primary"
          icon={<SettingFilled />}
          href={`/devices/${deviceId}`}
        ></Button>
      </Tooltip>
    </>
  )

  return (
    <PageContent
      title={
        <>
          Dashboard
          {isVirtualDevice ? (
            <Tooltip title="This page writes temperature measurements for the last 7 days from an emulated device, the temperature is reported every minute.">
              <InfoCircleFilled style={{fontSize: '1em', marginLeft: 5}} />
            </Tooltip>
          ) : undefined}
        </>
      }
      titleExtra={pageControls}
      message={message}
      spin={loading}
      forceShowScroll={true}
    >
      {deviceData?.measurementsTable?.length ? (
        <>
          {gauges}
          {geo}
          {plots}
        </>
      ) : (
        <Card>
          <Empty />
        </Card>
      )}
    </PageContent>
  )
}

export default DashboardPage
