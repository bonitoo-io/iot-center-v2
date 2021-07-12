import React, {useState, useEffect, FunctionComponent} from 'react'
import PageContent, {Message} from './PageContent'
import {
  Table,
  Button,
  Popconfirm,
  message as antdMessage,
  Tooltip,
  Modal,
  Form,
  Input,
} from 'antd'
import {Link} from 'react-router-dom'
import {ColumnsType} from 'antd/lib/table'
import {ExclamationCircleFilled} from '@ant-design/icons'
import {flux, InfluxDB} from '@influxdata/influxdb-client'
import {queryTable} from '../util/queryTable'
import {timeFormatter} from '@influxdata/giraffe'
import {VIRTUAL_DEVICE} from '../App'
import {IconDashboard, IconDelete, IconSettings} from '../styles/icons'

export interface DeviceInfo {
  key: string
  deviceId: string
  createdAt: string
}

const NO_DEVICES: Array<DeviceInfo> = []

interface LastEntryTime {
  deviceId: string
  lastEntry?: number
}

interface DeviceConfig {
  influx_url: string
  influx_org: string
  influx_token: string
  influx_bucket: string
  id: string
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

const fetchLastEntryTime = async (deviceId: string): Promise<LastEntryTime> => {
  const config = await fetchDeviceConfig(deviceId)
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
    |> range(start: -1y)
    |> filter(fn: (r) => r.clientId == ${id})
    |> filter(fn: (r) => r._measurement == "environment")
    |> keep(columns: ["_time"])
    |> max(column: "_time")
    `
  )
  const lastColumn = result.getColumn('_time')
  if (lastColumn !== null) {
    const [lastEntry] = lastColumn as number[]
    return {lastEntry, deviceId}
  }
  return {deviceId}
}

const NO_ENTRIES: Array<LastEntryTime> = []

interface Props {
  helpCollapsed: boolean
}

const DevicesPage: FunctionComponent<Props> = ({helpCollapsed}) => {
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<Message | undefined>(undefined)
  const [data, setData] = useState(NO_DEVICES)
  const [dataStamp, setDataStamp] = useState(0)
  const [lastEntries, setLastEntries] = useState(NO_ENTRIES)

  useEffect(() => {
    setLoading(true)
    const fetchDevices = async () => {
      try {
        const response = await fetch('/api/devices')
        if (response.status >= 300) {
          const text = await response.text()
          throw new Error(`${response.status} ${text}`)
        }
        const data = (await response.json()) as Array<DeviceInfo>
        setData(data)

        setLastEntries(
          await Promise.all(
            data.map(({deviceId}) => fetchLastEntryTime(deviceId))
          )
        )
      } catch (e) {
        setMessage({
          title: 'Cannot fetch data',
          description: String(e),
          type: 'error',
        })
      } finally {
        setLoading(false)
      }
    }
    fetchDevices()
  }, [dataStamp])

  const removeAuthorization = async (device: DeviceInfo) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/devices/${device.deviceId}`, {
        method: 'DELETE',
      })
      if (response.status >= 300) {
        const text = await response.text()
        throw new Error(`${response.status} ${text}`)
      }
      setLoading(false)
      antdMessage.success(`Device ${device.deviceId} was unregistered`, 2)
    } catch (e) {
      setLoading(false)
      setMessage({
        title: 'Cannot remove device',
        description: String(e),
        type: 'error',
      })
    } finally {
      setDataStamp(dataStamp + 1)
    }
  }

  const addAuthorization = async (deviceId: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/env/${deviceId}`)
      if (response.status >= 300) {
        const text = await response.text()
        throw new Error(`${response.status} ${text}`)
      }
      const {newlyRegistered} = await response.json()

      setLoading(false)
      if (newlyRegistered) {
        antdMessage.success(`Device '${deviceId}' was registered`, 2)
      } else {
        antdMessage.success(`Device '${deviceId}' is already registered`, 2)
      }
    } catch (e) {
      setLoading(false)
      setMessage({
        title: 'Cannot register device',
        description: String(e),
        type: 'error',
      })
    } finally {
      setDataStamp(dataStamp + 1)
    }
  }

  // define table columns
  const columnDefinitions: ColumnsType<DeviceInfo> = [
    {
      title: 'Device ID',
      dataIndex: 'deviceId',
      defaultSortOrder: 'ascend',
      render: (deviceId: string) => (
        <Link to={`/devices/${deviceId}`}>{deviceId}</Link>
      ),
    },
    {
      title: 'Registration Time',
      dataIndex: 'createdAt',
      responsive: helpCollapsed ? ['lg'] : ['xxl'],
    },
    {
      title: 'Last Entry',
      dataIndex: 'deviceId',
      render: (id: string) => {
        const lastEntry = lastEntries.find(({deviceId}) => deviceId === id)
          ?.lastEntry
        if (lastEntry != null && lastEntry !== 0)
          return timeFormatter({
            timeZone: 'UTC',
            format: 'YYYY-MM-DD HH:mm:ss ZZ',
          })(lastEntry)
      },
      responsive: helpCollapsed ? ['xl'] : [],
    },
    {
      title: '',
      key: 'action',
      align: 'right',
      render: (_: string, device: DeviceInfo) => (
        <>
          <Tooltip title="Go to device settings" placement="topRight">
            <Button
              type="text"
              icon={<IconSettings />}
              href={`/devices/${device.deviceId}`}
            />
          </Tooltip>
          <Tooltip title="Go to device dashboard" placement="topRight">
            <Button
              type="text"
              icon={<IconDashboard />}
              href={`/dashboard/${device.deviceId}`}
            />
          </Tooltip>
          <Popconfirm
            icon={<ExclamationCircleFilled style={{color: 'red'}} />}
            title={`Are you sure to remove '${device.deviceId}' ?`}
            onConfirm={() => removeAuthorization(device)}
            okText="Yes"
            okType="danger"
            cancelText="No"
          >
            <Tooltip title="Remove device" placement="topRight" color="red">
              <Button type="text" icon={<IconDelete />} />
            </Tooltip>
          </Popconfirm>
        </>
      ),
    },
  ]

  return (
    <PageContent
      title="Device Registrations"
      spin={loading}
      message={message}
      titleExtra={
        <>
          <Tooltip title="Register a new Device">
            <Button
              onClick={() => {
                let deviceId = ''
                Modal.confirm({
                  title: 'Register Device',
                  icon: '',
                  content: (
                    <Form name="registerDevice" initialValues={{deviceId}}>
                      <Form.Item
                        name="deviceId"
                        rules={[
                          {required: true, message: 'Please input device ID !'},
                        ]}
                      >
                        <Input
                          placeholder="Device ID"
                          onChange={(e) => (deviceId = e.target.value)}
                        />
                      </Form.Item>
                    </Form>
                  ),
                  onOk: () => {
                    addAuthorization(deviceId)
                  },
                  okText: 'Register',
                })
              }}
            >
              Register
            </Button>
          </Tooltip>
          <Tooltip title="Reload Table">
            <Button
              type="primary"
              onClick={() => setDataStamp(dataStamp + 1)}
              style={{marginRight: '8px'}}
            >
              Reload
            </Button>
          </Tooltip>
        </>
      }
    >
      <Table dataSource={data} columns={columnDefinitions}></Table>
    </PageContent>
  )
}

export default DevicesPage
