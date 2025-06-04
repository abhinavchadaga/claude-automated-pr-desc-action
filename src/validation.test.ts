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
  getApiKeys
} from './validation.js'

describe('validation.ts', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()

    // Reset process.exit mock
    jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })
    
    // Reset environment
    process.env = { ...originalEnv }
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.GITHUB_TOKEN
    
    // Reset context
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
      // Arrange
      context.eventName = 'pull_request'

      // Act & Assert
      expect(() => validatePullRequestEvent()).not.toThrow()
    })

    it('should throw error for push event', () => {
      // Arrange
      context.eventName = 'push'

      // Act & Assert
      expect(() => validatePullRequestEvent()).toThrow(
        'This action can only be used in pull request events.'
      )
    })

    it('should throw error for issue event', () => {
      // Arrange
      context.eventName = 'issues'

      // Act & Assert
      expect(() => validatePullRequestEvent()).toThrow(
        'This action can only be used in pull request events.'
      )
    })

    it('should throw error for workflow_dispatch event', () => {
      // Arrange
      context.eventName = 'workflow_dispatch'

      // Act & Assert
      expect(() => validatePullRequestEvent()).toThrow(
        'This action can only be used in pull request events.'
      )
    })

    it('should throw error for undefined event', () => {
      // Arrange
      context.eventName = undefined as any

      // Act & Assert
      expect(() => validatePullRequestEvent()).toThrow(
        'This action can only be used in pull request events.'
      )
    })
  })

  describe('validatePullRequestAction', () => {
    it('should pass validation for opened action', () => {
      // Arrange
      context.payload = {
        action: 'opened'
      }

      // Act & Assert
      expect(() => validatePullRequestAction()).not.toThrow()
    })

    it('should pass validation for synchronize action', () => {
      // Arrange
      context.payload = {
        action: 'synchronize'
      }

      // Act & Assert
      expect(() => validatePullRequestAction()).not.toThrow()
    })

    it('should pass validation for reopened action', () => {
      // Arrange
      context.payload = {
        action: 'reopened'
      }

      // Act & Assert
      expect(() => validatePullRequestAction()).not.toThrow()
    })

    it('should exit process for closed action', () => {
      // Arrange
      context.payload = {
        action: 'closed'
      }

      // Act & Assert
      expect(() => validatePullRequestAction()).toThrow('process.exit called')
      expect(core.info).toHaveBeenCalledWith(
        'Skipping action for PR action: closed'
      )
    })

    it('should exit process for edited action', () => {
      // Arrange
      context.payload = {
        action: 'edited'
      }

      // Act & Assert
      expect(() => validatePullRequestAction()).toThrow('process.exit called')
      expect(core.info).toHaveBeenCalledWith(
        'Skipping action for PR action: edited'
      )
    })

    it('should exit process for unknown action', () => {
      // Arrange
      context.payload = {
        action: 'some_unknown_action'
      }

      // Act & Assert
      expect(() => validatePullRequestAction()).toThrow('process.exit called')
      expect(core.info).toHaveBeenCalledWith(
        'Skipping action for PR action: some_unknown_action'
      )
    })

    it('should exit process for null action', () => {
      // Arrange
      context.payload = {
        action: null
      }

      // Act & Assert
      expect(() => validatePullRequestAction()).toThrow('process.exit called')
      expect(core.info).toHaveBeenCalledWith(
        'Skipping action for PR action: unknown'
      )
    })

    it('should exit process for undefined action', () => {
      // Arrange
      context.payload = {
        action: undefined
      }

      // Act & Assert
      expect(() => validatePullRequestAction()).toThrow('process.exit called')
      expect(core.info).toHaveBeenCalledWith(
        'Skipping action for PR action: unknown'
      )
    })

    it('should exit process for missing payload', () => {
      // Arrange
      context.payload = {}

      // Act & Assert
      expect(() => validatePullRequestAction()).toThrow('process.exit called')
      expect(core.info).toHaveBeenCalledWith(
        'Skipping action for PR action: unknown'
      )
    })
  })

  describe('extractPRInfo', () => {
    it('should extract PR info successfully', () => {
      // Arrange
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

      // Act
      const result = extractPRInfo()

      // Assert
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
      // Arrange
      context.payload = {}

      // Act & Assert
      expect(() => extractPRInfo()).toThrow('No pull request found in context')
    })

    it('should throw error when pull_request is null', () => {
      // Arrange
      context.payload = {
        pull_request: null
      }

      // Act & Assert
      expect(() => extractPRInfo()).toThrow('No pull request found in context')
    })

    it('should throw error when title is missing', () => {
      // Arrange
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

      // Act & Assert
      expect(() => extractPRInfo()).toThrow(
        'Required PR fields are missing (title, author, base SHA, head SHA, or URL)'
      )
    })

    it('should throw error when user is missing', () => {
      // Arrange
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

      // Act & Assert
      expect(() => extractPRInfo()).toThrow(
        'Required PR fields are missing (title, author, base SHA, head SHA, or URL)'
      )
    })

    it('should throw error when user login is missing', () => {
      // Arrange
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

      // Act & Assert
      expect(() => extractPRInfo()).toThrow(
        'Required PR fields are missing (title, author, base SHA, head SHA, or URL)'
      )
    })

    it('should throw error when base SHA is missing', () => {
      // Arrange
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

      // Act & Assert
      expect(() => extractPRInfo()).toThrow(
        'Required PR fields are missing (title, author, base SHA, head SHA, or URL)'
      )
    })

    it('should throw error when head SHA is missing', () => {
      // Arrange
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

      // Act & Assert
      expect(() => extractPRInfo()).toThrow(
        'Required PR fields are missing (title, author, base SHA, head SHA, or URL)'
      )
    })

    it('should throw error when URL is missing', () => {
      // Arrange
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

      // Act & Assert
      expect(() => extractPRInfo()).toThrow(
        'Required PR fields are missing (title, author, base SHA, head SHA, or URL)'
      )
    })
  })

  describe('getApiKeys', () => {
    it('should get API keys from inputs', () => {
      // Arrange
      ;(core.getInput as jest.MockedFunction<typeof core.getInput>).mockImplementation((name: string) => {
        if (name === 'anthropic-api-key') return 'test-anthropic-key'
        if (name === 'github-token') return 'test-github-token'
        return ''
      })

      // Act
      const result = getApiKeys()

      // Assert
      expect(result).toEqual({
        anthropicApiKey: 'test-anthropic-key',
        githubToken: 'test-github-token'
      })
    })

    it('should get API keys from environment variables', () => {
      // Arrange
      process.env.ANTHROPIC_API_KEY = 'env-anthropic-key'
      process.env.GITHUB_TOKEN = 'env-github-token'
      ;(core.getInput as jest.MockedFunction<typeof core.getInput>).mockReturnValue('')

      // Act
      const result = getApiKeys()

      // Assert
      expect(result).toEqual({
        anthropicApiKey: 'env-anthropic-key',
        githubToken: 'env-github-token'
      })
    })

    it('should prefer input over environment variable', () => {
      // Arrange
      process.env.ANTHROPIC_API_KEY = 'env-anthropic-key'
      process.env.GITHUB_TOKEN = 'env-github-token'
      ;(core.getInput as jest.MockedFunction<typeof core.getInput>).mockImplementation((name: string) => {
        if (name === 'anthropic-api-key') return 'input-anthropic-key'
        if (name === 'github-token') return 'input-github-token'
        return ''
      })

      // Act
      const result = getApiKeys()

      // Assert
      expect(result).toEqual({
        anthropicApiKey: 'input-anthropic-key',
        githubToken: 'input-github-token'
      })
    })

    it('should mix input and environment variables', () => {
      // Arrange
      process.env.ANTHROPIC_API_KEY = 'env-anthropic-key'
      ;(core.getInput as jest.MockedFunction<typeof core.getInput>).mockImplementation((name: string) => {
        if (name === 'github-token') return 'input-github-token'
        return ''
      })

      // Act
      const result = getApiKeys()

      // Assert
      expect(result).toEqual({
        anthropicApiKey: 'env-anthropic-key',
        githubToken: 'input-github-token'
      })
    })

    it('should throw error when Anthropic API key is missing', () => {
      // Arrange
      ;(core.getInput as jest.MockedFunction<typeof core.getInput>).mockImplementation((name: string) => {
        if (name === 'github-token') return 'test-github-token'
        return ''
      })

      // Act & Assert
      expect(() => getApiKeys()).toThrow(
        'Anthropic API key not found. Please set the anthropic-api-key input or ANTHROPIC_API_KEY environment variable.'
      )
    })

    it('should throw error when GitHub token is missing', () => {
      // Arrange
      ;(core.getInput as jest.MockedFunction<typeof core.getInput>).mockImplementation((name: string) => {
        if (name === 'anthropic-api-key') return 'test-anthropic-key'
        return ''
      })

      // Act & Assert
      expect(() => getApiKeys()).toThrow(
        'GitHub token not found. Please set the github-token input or GITHUB_TOKEN environment variable.'
      )
    })

    it('should throw error when both API keys are missing', () => {
      // Arrange
      ;(core.getInput as jest.MockedFunction<typeof core.getInput>).mockReturnValue('')

      // Act & Assert
      expect(() => getApiKeys()).toThrow(
        'Anthropic API key not found. Please set the anthropic-api-key input or ANTHROPIC_API_KEY environment variable.'
      )
    })

    it('should handle empty string inputs', () => {
      // Arrange
      process.env.ANTHROPIC_API_KEY = 'env-anthropic-key'
      process.env.GITHUB_TOKEN = 'env-github-token'
      ;(core.getInput as jest.MockedFunction<typeof core.getInput>).mockReturnValue('')

      // Act
      const result = getApiKeys()

      // Assert
      expect(result).toEqual({
        anthropicApiKey: 'env-anthropic-key',
        githubToken: 'env-github-token'
      })
    })

    it('should handle whitespace-only inputs', () => {
      // Arrange
      process.env.ANTHROPIC_API_KEY = 'env-anthropic-key'
      process.env.GITHUB_TOKEN = 'env-github-token'
      ;(core.getInput as jest.MockedFunction<typeof core.getInput>).mockReturnValue('   ')

      // Act
      const result = getApiKeys()

      // Assert
      expect(result).toEqual({
        anthropicApiKey: '   ',
        githubToken: '   '
      })
    })
  })
})