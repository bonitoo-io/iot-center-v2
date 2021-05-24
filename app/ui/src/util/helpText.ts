const PAGE_HELP_BASE_URL = {
  __DEV_GUIDE__: process.env.REACT_APP_DEV_GUIDE_URL,
}

export const helpLinkTransformer = (url: string) => {
  Object.keys(PAGE_HELP_BASE_URL).forEach((k) => {
    const keyExp = RegExp(`^${k}`)
    url = url.replace(keyExp, PAGE_HELP_BASE_URL[k])
  })
  return url
}
