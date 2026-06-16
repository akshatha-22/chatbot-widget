export type TMessageSource = 'document' | 'both' | 'web' | 'none'

export interface TExternalLink {
  url: string
  title: string
}

export interface TMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
  has_pdf: boolean
  cache_hit: boolean
  source: TMessageSource
  links: TExternalLink[]
}
