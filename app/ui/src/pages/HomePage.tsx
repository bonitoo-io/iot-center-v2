import React, {FunctionComponent, useEffect, useState} from 'react'
import Markdown from '../util/Markdown'
import PageContent from './PageContent'
import {helpLinkTransformer} from '../util/helpText'

const Home: FunctionComponent = () => {
  const [helpText, setHelpText] = useState('')

  useEffect(() => {
    // load markdown from file
    ;(async () => {
      try {
        const response = await fetch('/help/HomePage.md')
        const txt = await response.text()
        setHelpText((txt ?? '').startsWith('<!') ? 'HELP NOT FOUND' : txt)
      } catch (e) {
        console.error(e)
      }
    })()
  }, [])

  return (
    <PageContent title="">
      {helpText ? (
        <Markdown source={helpText} linkTransformer={helpLinkTransformer} />
      ) : undefined}
    </PageContent>
  )
}

export default Home
