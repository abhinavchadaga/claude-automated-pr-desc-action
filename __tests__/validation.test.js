import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach
} from '@jest/globals'
import * as core from '@actions/core'
import { context } from '@actions/github'
import {
  validatePullRequestEvent,
  validatePullRequestAction,
  extractPRInfo,
  getConfig
} from '../src/validation.js'

describe('validation.js', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()

    jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })

    process.env = { ...originalEnv }
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.GITHUB_TOKEN

    Object.assign(context, {
      eventName: '',
      payload: {}
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    process.env = originalEnv
  })

  describe('validatePullRequestEvent', () => {
    it('should pass validation for pull_request event', () => {
      context.eventName = 'pull_request'

      expect(() => validatePullRequestEvent()).not.toThrow()
    })

    it('should throw error for push event', () => {
      context.eventName = 'push'

      expect(() => validatePullRequestEvent()).toThrow(
        'This action can only be used in pull request events.'
      )
    })

    it('should throw error for issue event', () => {
      context.eventName = 'issues'

      expect(() => validatePullRequestEvent()).toThrow(
        'This action can only be used in pull request events.'
      )
    })

    it('should throw error for workflow_dispatch event', () => {
      context.eventName = 'workflow_dispatch'

      expect(() => validatePullRequestEvent()).toThrow(
        'This action can only be used in pull request events.'
      )
    })

    it('should throw error for undefined event', () => {
      context.eventName = undefined

      expect(() => validatePullRequestEvent()).toThrow(
        'This action can only be used in pull request events.'
      )
    })
  })

  describe('validatePullRequestAction', () => {
    it('should pass validation for opened action', () => {
      context.payload = {
        action: 'opened'
      }

      expect(() => validatePullRequestAction()).not.toThrow()
    })

    it('should pass validation for synchronize action', () => {
      context.payload = {
        action: 'synchronize'
      }

      expect(() => validatePullRequestAction()).not.toThrow()
    })

    it('should pass validation for reopened action', () => {
      context.payload = {
        action: 'reopened'
      }

      expect(() => validatePullRequestAction()).not.toThrow()
    })

    it('should exit process for closed action', () => {
      context.payload = {
        action: 'closed'
      }

      expect(() => validatePullRequestAction()).toThrow('process.exit called')
      expect(core.info).toHaveBeenCalledWith(
        'Skipping action for PR action: closed'
      )
    })

    it('should exit process for edited action', () => {
      context.payload = {
        action: 'edited'
      }

      expect(() => validatePullRequestAction()).toThrow('process.exit called')
      expect(core.info).toHaveBeenCalledWith(
        'Skipping action for PR action: edited'
      )
    })

    it('should exit process for unknown action', () => {
      context.payload = {
        action: 'some_unknown_action'
      }

      expect(() => validatePullRequestAction()).toThrow('process.exit called')
      expect(core.info).toHaveBeenCalledWith(
        'Skipping action for PR action: some_unknown_action'
      )
    })

    it('should exit process for null action', () => {
      context.payload = {
        action: null
      }

      expect(() => validatePullRequestAction()).toThrow('process.exit called')
      expect(core.info).toHaveBeenCalledWith(
        'Skipping action for PR action: unknown'
      )
    })

    it('should exit process for undefined action', () => {
      context.payload = {
        action: undefined
      }

      expect(() => validatePullRequestAction()).toThrow('process.exit called')
      expect(core.info).toHaveBeenCalledWith(
        'Skipping action for PR action: unknown'
      )
    })

    it('should exit process for missing payload', () => {
      context.payload = {}

      expect(() => validatePullRequestAction()).toThrow('process.exit called')
      expect(core.info).toHaveBeenCalledWith(
        'Skipping action for PR action: unknown'
      )
    })
  })

  describe('extractPRInfo', () => {
    it('should extract PR info successfully', () => {
      const mockPR = {
        number: 123,
        title: 'Test PR Title',
        user: {
          login: 'testuser'
        },
        base: {
          sha: 'base-sha-123'
        },
        head: {
          sha: 'head-sha-456'
        },
        html_url: 'https://github.com/owner/repo/pull/123'
      }

      context.payload = {
        pull_request: mockPR
      }

      const result = extractPRInfo()

      expect(result).toEqual({
        number: 123,
        title: 'Test PR Title',
        author: 'testuser',
        baseSha: 'base-sha-123',
        headSha: 'head-sha-456',
        url: 'https://github.com/owner/repo/pull/123'
      })
    })

    it('should throw error when pull_request is missing', () => {
      context.payload = {}

      expect(() => extractPRInfo()).toThrow('No pull request found in context')
    })

    it('should throw error when pull_request is null', () => {
      context.payload = {
        pull_request: null
      }

      expect(() => extractPRInfo()).toThrow('No pull request found in context')
    })

    it('should throw error when title is missing', () => {
      const mockPR = {
        number: 123,
        title: null,
        user: {
          login: 'testuser'
        },
        base: {
          sha: 'base-sha-123'
        },
        head: {
          sha: 'head-sha-456'
        },
        html_url: 'https://github.com/owner/repo/pull/123'
      }

      context.payload = {
        pull_request: mockPR
      }

      expect(() => extractPRInfo()).toThrow(
        'Required PR fields are missing (title, author, base SHA, head SHA, or URL)'
      )
    })

    it('should throw error when user is missing', () => {
      const mockPR = {
        number: 123,
        title: 'Test PR',
        user: null,
        base: {
          sha: 'base-sha-123'
        },
        head: {
          sha: 'head-sha-456'
        },
        html_url: 'https://github.com/owner/repo/pull/123'
      }

      context.payload = {
        pull_request: mockPR
      }

      expect(() => extractPRInfo()).toThrow(
        'Required PR fields are missing (title, author, base SHA, head SHA, or URL)'
      )
    })

    it('should throw error when user login is missing', () => {
      const mockPR = {
        number: 123,
        title: 'Test PR',
        user: {
          login: null
        },
        base: {
          sha: 'base-sha-123'
        },
        head: {
          sha: 'head-sha-456'
        },
        html_url: 'https://github.com/owner/repo/pull/123'
      }

      context.payload = {
        pull_request: mockPR
      }

      expect(() => extractPRInfo()).toThrow(
        'Required PR fields are missing (title, author, base SHA, head SHA, or URL)'
      )
    })

    it('should throw error when base SHA is missing', () => {
      const mockPR = {
        number: 123,
        title: 'Test PR',
        user: {
          login: 'testuser'
        },
        base: {
          sha: null
        },
        head: {
          sha: 'head-sha-456'
        },
        html_url: 'https://github.com/owner/repo/pull/123'
      }

      context.payload = {
        pull_request: mockPR
      }

      expect(() => extractPRInfo()).toThrow(
        'Required PR fields are missing (title, author, base SHA, head SHA, or URL)'
      )
    })

    it('should throw error when head SHA is missing', () => {
      const mockPR = {
        number: 123,
        title: 'Test PR',
        user: {
          login: 'testuser'
        },
        base: {
          sha: 'base-sha-123'
        },
        head: {
          sha: null
        },
        html_url: 'https://github.com/owner/repo/pull/123'
      }

      context.payload = {
        pull_request: mockPR
      }

      expect(() => extractPRInfo()).toThrow(
        'Required PR fields are missing (title, author, base SHA, head SHA, or URL)'
      )
    })

    it('should throw error when URL is missing', () => {
      const mockPR = {
        number: 123,
        title: 'Test PR',
        user: {
          login: 'testuser'
        },
        base: {
          sha: 'base-sha-123'
        },
        head: {
          sha: 'head-sha-456'
        },
        html_url: null
      }

      context.payload = {
        pull_request: mockPR
      }

      expect(() => extractPRInfo()).toThrow(
        'Required PR fields are missing (title, author, base SHA, head SHA, or URL)'
      )
    })
  })

  describe('getConfig', () => {
    it('should get config from inputs', () => {
      core.getInput.mockImplementation((name) => {
        if (name === 'anthropic-api-key') return 'test-anthropic-key'
        if (name === 'github-token') return 'test-github-token'
        return ''
      })

      const result = getConfig()

      expect(result).toEqual({
        anthropicApiKey: 'test-anthropic-key',
        githubToken: 'test-github-token',
        ignoredPatterns: []
      })
    })

    it('should throw error when Anthropic API key is missing', () => {
      core.getInput.mockImplementation((name) => {
        if (name === 'github-token') return 'test-github-token'
        return ''
      })

      expect(() => getConfig()).toThrow(
        'Anthropic API key not found. Please set the anthropic-api-key input or ANTHROPIC_API_KEY environment variable.'
      )
    })

    it('should throw error when GitHub token is missing', () => {
      core.getInput.mockImplementation((name) => {
        if (name === 'anthropic-api-key') return 'test-anthropic-key'
        return ''
      })

      expect(() => getConfig()).toThrow(
        'GitHub token not found. Please set the github-token input or GITHUB_TOKEN environment variable.'
      )
    })

    it('should throw error when both API keys are missing', () => {
      core.getInput.mockReturnValue('')

      expect(() => getConfig()).toThrow(
        'Anthropic API key not found. Please set the anthropic-api-key input or ANTHROPIC_API_KEY environment variable.'
      )
    })

    it('should handle empty string inputs', () => {
      core.getInput.mockImplementation((name) => {
        if (name === 'anthropic-api-key') return 'test-anthropic-key'
        if (name === 'github-token') return 'test-github-token'
        return ''
      })

      const result = getConfig()

      expect(result).toEqual({
        anthropicApiKey: 'test-anthropic-key',
        githubToken: 'test-github-token',
        ignoredPatterns: []
      })
    })

    it('should handle whitespace-only inputs', () => {
      core.getInput.mockReturnValue('   ')

      const result = getConfig()

      expect(result).toEqual({
        anthropicApiKey: '   ',
        githubToken: '   ',
        ignoredPatterns: []
      })
    })

    it('should parse ignore-patterns input correctly', () => {
      core.getInput.mockImplementation((name) => {
        if (name === 'anthropic-api-key') return 'test-anthropic-key'
        if (name === 'github-token') return 'test-github-token'
        if (name === 'ignore-patterns')
          return 'dist/**,**/*.min.js,node_modules/**'
        return ''
      })

      const result = getConfig()

      expect(result).toEqual({
        anthropicApiKey: 'test-anthropic-key',
        githubToken: 'test-github-token',
        ignoredPatterns: ['dist/**', '**/*.min.js', 'node_modules/**']
      })
    })

    it('should handle ignore-patterns with whitespace', () => {
      core.getInput.mockImplementation((name) => {
        if (name === 'anthropic-api-key') return 'test-anthropic-key'
        if (name === 'github-token') return 'test-github-token'
        if (name === 'ignore-patterns')
          return ' dist/** , **/*.min.js , node_modules/** '
        return ''
      })

      const result = getConfig()

      expect(result).toEqual({
        anthropicApiKey: 'test-anthropic-key',
        githubToken: 'test-github-token',
        ignoredPatterns: ['dist/**', '**/*.min.js', 'node_modules/**']
      })
    })

    it('should handle empty ignore-patterns', () => {
      core.getInput.mockImplementation((name) => {
        if (name === 'anthropic-api-key') return 'test-anthropic-key'
        if (name === 'github-token') return 'test-github-token'
        if (name === 'ignore-patterns') return ''
        return ''
      })

      const result = getConfig()

      expect(result).toEqual({
        anthropicApiKey: 'test-anthropic-key',
        githubToken: 'test-github-token',
        ignoredPatterns: []
      })
    })
  })
})
