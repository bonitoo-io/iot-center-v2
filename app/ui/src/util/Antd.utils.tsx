import * as React from 'react'

export const Title: React.FC<{style?: React.CSSProperties}> = ({
  children,
  style,
}) => {
  return (
    <div className="ant-descriptions-header" style={style || {}}>
      <div className="ant-descriptions-title">{children}</div>
    </div>
  )
}
