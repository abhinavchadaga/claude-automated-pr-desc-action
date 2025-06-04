export interface PRInfo {
  number: number
  title: string
  author: string
  baseSha: string
  headSha: string
  url: string
}

export interface ApiKeys {
  anthropicApiKey: string
  githubToken: string
}

export interface PRContext {
  prInfo: PRInfo
  commitMessages: string
  diff: string
}
