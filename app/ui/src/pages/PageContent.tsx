import React, {ReactNode, FunctionComponent} from 'react'
import {Layout, PageHeader, Spin, Alert} from 'antd'

export interface Message {
  title: string
  description: string
  type: 'info' | 'error'
}

export interface PageContentProps {
  title: ReactNode
  titleExtra?: ReactNode
  children: ReactNode
  spin?: boolean
  message?: Message
  forceShowScroll?: boolean
}

const PageContent: FunctionComponent<PageContentProps> = (props) => {
  const content = props.spin ? (
    <div className="site-layout-background" style={{minHeight: 360}}>
      <Spin>{props.children}</Spin>
    </div>
  ) : (
    <div className="site-layout-background" style={{minHeight: 360}}>
      {props.children}
    </div>
  )
  return (
    <Layout.Content
      style={{
        paddingLeft: 60,
        paddingRight: 60,
        paddingTop: 55,
        margin: 0,
        minHeight: 280,
        minWidth: 350,
        height: '100vh',
        overflowY: props.forceShowScroll ? 'scroll' : 'auto',
      }}
    >
      <PageHeader
        title={props.title}
        style={{paddingLeft: 0, paddingRight: 0, paddingTop: 0}}
        extra={props?.titleExtra}
      />
      {props.message ? (
        <Alert
          message={props.message.title}
          description={props.message.description}
          type={props.message.type}
          showIcon
          closable
        />
      ) : undefined}
      {content}
    </Layout.Content>
  )
}
export default PageContent
