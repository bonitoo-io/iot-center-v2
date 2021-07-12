import React from 'react'
import {Col, Row} from 'antd'
import {Title} from './Antd.utils'
import {Breakpoint} from 'antd/lib/_util/responsiveObserve'
import {colorBodyBg1} from '../styles/colors'

type AntdColumns = number | Partial<Record<Breakpoint, number>> | undefined

export type GridDescriptionProps = {
  title?: string
  descriptions: {label: string; value: string | undefined}[]
  column?: AntdColumns
}

/**
 * map function on all values of object properties
 */
const objectMapValues = <T extends {[key: string]: V}, V, R>(
  obj: T,
  fnc: (val: V) => R
) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fnc(v)]))

/**
 * returns column span for desired number of columns
 */
const calculateColSpan = (x: number) => Math.floor(24 / x)

const columnsToSpan = (columns: AntdColumns) =>
  typeof columns === 'number'
    ? {xs: calculateColSpan(columns)}
    : columns === undefined
    ? {xs: calculateColSpan(1)}
    : objectMapValues(columns, calculateColSpan)

export const GridDescription: React.FC<GridDescriptionProps> = (props) => (
  <>
    <Title>{props.title || ''}</Title>
    <Row
      gutter={[36, 4]}
      style={{
        filter: 'drop-shadow(0px 0px 25px rgba(0, 0, 0, 0.15))',
      }}
    >
      {props.descriptions.map(({label, value}) => (
        <Col {...columnsToSpan(props.column)}>
          <Row
            style={{
              whiteSpace: 'nowrap',
            }}
          >
            <Col
              style={{
                padding: '16px 24px',
                borderRight: '1px solid #f0f0f0',
                background: colorBodyBg1,
                fontSize: '16px',
              }}
              xs={10}
            >
              {label}
            </Col>
            <Col
              style={{
                // bottom padding is set to 0 so horizontal scroll doesn't expand height
                padding: '16px 24px 0px 24px',
                overflowX: 'auto',
                background: 'white',
              }}
              xs={14}
            >
              {value}
            </Col>
          </Row>
        </Col>
      ))}
    </Row>
  </>
)
