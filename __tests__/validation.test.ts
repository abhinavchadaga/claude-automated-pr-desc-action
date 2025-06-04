import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

const mockContext: any = { eventName: 'pull_request', payload: {}, repo: {} }

jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('@actions/github', () => ({ context: mockContext }))

const {
  validatePullRequestEvent,
  validatePullRequestAction,
  extractPRInfo,
  getApiKeys
} = await import('../src/validation.js')

describe('validation helpers', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    mockContext.eventName = 'pull_request'
    mockContext.payload = {}
  })

  describe('validatePullRequestEvent', () => {
    it('passes for pull_request event', () => {
      expect(() => validatePullRequestEvent()).not.toThrow()
    })

    it('throws for other events', () => {
      mockContext.eventName = 'push'
      expect(() => validatePullRequestEvent()).toThrow(
        'This action can only be used in pull request events.'
      )
    })
  })

  describe('validatePullRequestAction', () => {
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => undefined) as never)

    afterEach(() => {
      exitSpy.mockClear()
    })

    it('exits when action is not allowed', () => {
      mockContext.payload.action = 'closed'
      validatePullRequestAction()
      expect(core.info).toHaveBeenCalledWith('Skipping action for PR action: closed')
      expect(exitSpy).toHaveBeenCalledWith(0)
    })

    it('does nothing for allowed action', () => {
      mockContext.payload.action = 'opened'
      validatePullRequestAction()
      expect(exitSpy).not.toHaveBeenCalled()
    })
  })

  describe('extractPRInfo', () => {
    it('extracts info from context', () => {
      mockContext.payload.pull_request = {
        number: 1,
        title: 't',
        user: { login: 'me' },
        base: { sha: 'a' },
        head: { sha: 'b' },
        html_url: 'url'
      }
      expect(extractPRInfo()).toEqual({
        number: 1,
        title: 't',
        author: 'me',
        baseSha: 'a',
        headSha: 'b',
        url: 'url'
      })
    })

    it('throws when pull_request missing', () => {
      delete mockContext.payload.pull_request
      expect(() => extractPRInfo()).toThrow('No pull request found in context')
    })

    it('throws when fields missing', () => {
      mockContext.payload.pull_request = {
        number: 1,
        title: '',
        user: { login: 'me' },
        base: { sha: 'a' },
        head: { sha: 'b' },
        html_url: 'url'
      }
      expect(() => extractPRInfo()).toThrow(
        'Required PR fields are missing (title, author, base SHA, head SHA, or URL)'
      )
    })
  })

  describe('getApiKeys', () => {
    const envBackup = { ...process.env }

    afterEach(() => {
      process.env = { ...envBackup }
    })

    it('returns keys from env', () => {
      core.getInput.mockReturnValueOnce('') // anthropic
      core.getInput.mockReturnValueOnce('') // github token
      process.env.ANTHROPIC_API_KEY = 'a'
      process.env.GITHUB_TOKEN = 'g'
      expect(getApiKeys()).toEqual({ anthropicApiKey: 'a', githubToken: 'g' })
    })

    it('throws when anthropic key missing', () => {
      core.getInput.mockReturnValueOnce('')
      core.getInput.mockReturnValueOnce('token')
      delete process.env.ANTHROPIC_API_KEY
      process.env.GITHUB_TOKEN = 'g'
      expect(() => getApiKeys()).toThrow('Anthropic API key not found')
    })

    it('throws when github token missing', () => {
      core.getInput.mockReturnValueOnce('key')
      core.getInput.mockReturnValueOnce('')
      process.env.ANTHROPIC_API_KEY = 'a'
      delete process.env.GITHUB_TOKEN
      expect(() => getApiKeys()).toThrow('GitHub token not found')
    })
  })
})
