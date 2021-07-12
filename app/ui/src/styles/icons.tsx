import React from 'react'
import Icon from '@ant-design/icons'

import {ReactComponent as DashboardSvg} from './icons/dashboard.svg'
import {ReactComponent as DeleteSvg} from './icons/delete.svg'
import {ReactComponent as SettingsSvg} from './icons/settings.svg'
import {ReactComponent as DeviceRegistrationSvg} from './icons/deviceRegistration.svg'
import {ReactComponent as HomeSvg} from './icons/home.svg'
import {ReactComponent as VirtualDeviceSvg} from './icons/virtualDevice.svg'
import {ReactComponent as RefreshSvg} from './icons/refresh.svg'
import {ReactComponent as WriteDataSvg} from './icons/writeData.svg'

export const IconDashboard = () => <Icon component={DashboardSvg} />
export const IconDelete = () => <Icon component={DeleteSvg} />
export const IconSettings = () => <Icon component={SettingsSvg} />
export const IconDeviceRegistration = () => (
  <Icon component={DeviceRegistrationSvg} />
)
export const IconHome = () => <Icon component={HomeSvg} />
export const IconVirtualDevice = () => <Icon component={VirtualDeviceSvg} />
export const IconRefresh = () => <Icon component={RefreshSvg} />
export const IconWriteData = () => <Icon component={WriteDataSvg} />
