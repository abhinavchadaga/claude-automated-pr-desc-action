import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach
} from '@jest/globals'
import * as core from '@actions/core'
import * as github from '@actions/github'
import { context } from '@actions/github'
import {
  generateDiff,
  getCommitMessages,
  updatePRDescription
} from './github.js'

// Mock the dependencies
jest.mock('@actions/core')
jest.mock('@actions/github')

const mockCore = core as jest.Mocked<typeof core>
const mockGithub = github as jest.Mocked<typeof github>
const mockContext = context as jest.Mocked<typeof context>

describe('github.ts', () => {
  let mockOctokit: jest.Mocked<ReturnType<typeof github.getOctokit>>

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup context mock
    Object.assign(mockContext, {
      repo: {
        owner: 'test-owner',
        repo: 'test-repo'
      }
    })

    // Setup octokit mock
    mockOctokit = {
      rest: {
        repos: {
          compareCommitsWithBasehead: jest.fn()
        },
        pulls: {
          listCommits: jest.fn(),
          update: jest.fn()
        }
      }
    } as jest.Mocked<ReturnType<typeof github.getOctokit>>

    mockGithub.getOctokit.mockReturnValue(mockOctokit)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('generateDiff', () => {
    const baseSha = 'abc123'
    const headSha = 'def456'

    it('should generate diff successfully', async () => {
      // Arrange
      const expectedDiff = 'diff --git a/file.ts b/file.ts\n+added line\n-removed line'
      mockOctokit.rest.repos.compareCommitsWithBasehead.mockResolvedValue({
        data: expectedDiff
      } as never)

      // Act
      const result = await generateDiff(mockOctokit, baseSha, headSha)

      // Assert
      expect(result).toBe(expectedDiff)
      expect(mockOctokit.rest.repos.compareCommitsWithBasehead).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        basehead: `${baseSha}...${headSha}`,
        mediaType: {
          format: 'diff'
        }
      })
      expect(mockCore.info).toHaveBeenCalledWith('Generating diff using GitHub API...')
      expect(mockCore.info).toHaveBeenCalledWith(`Computed Diff: ${expectedDiff}`)
    })

    it('should handle empty diff', async () => {
      // Arrange
      const emptyDiff = ''
      mockOctokit.rest.repos.compareCommitsWithBasehead.mockResolvedValue({
        data: emptyDiff
      } as never)

      // Act
      const result = await generateDiff(mockOctokit, baseSha, headSha)

      // Assert
      expect(result).toBe(emptyDiff)
      expect(mockCore.info).toHaveBeenCalledWith('Computed Diff: ')
    })

    it('should handle API errors', async () => {
      // Arrange
      const apiError = new Error('API rate limit exceeded')
      mockOctokit.rest.repos.compareCommitsWithBasehead.mockRejectedValue(apiError)

      // Act & Assert
      await expect(generateDiff(mockOctokit, baseSha, headSha))
        .rejects
        .toThrow('Failed to generate diff: Error: API rate limit exceeded')
    })

    it('should handle network errors', async () => {
      // Arrange
      const networkError = new Error('Network timeout')
      mockOctokit.rest.repos.compareCommitsWithBasehead.mockRejectedValue(networkError)

      // Act & Assert
      await expect(generateDiff(mockOctokit, baseSha, headSha))
        .rejects
        .toThrow('Failed to generate diff: Error: Network timeout')
    })

    it('should handle 404 errors for missing commits', async () => {
      // Arrange
      const notFoundError = new Error('Not Found')
      mockOctokit.rest.repos.compareCommitsWithBasehead.mockRejectedValue(notFoundError)

      // Act & Assert
      await expect(generateDiff(mockOctokit, baseSha, headSha))
        .rejects
        .toThrow('Failed to generate diff: Error: Not Found')
    })
  })

  describe('getCommitMessages', () => {
    const prNumber = 123

    it('should get commit messages successfully', async () => {
      // Arrange
      const mockCommits = [
        {
          sha: 'abcdef1234567890',
          commit: {
            message: 'Initial commit\n\nDetailed description'
          }
        },
        {
          sha: '1234567890abcdef',
          commit: {
            message: 'Add feature X'
          }
        },
        {
          sha: 'fedcba0987654321',
          commit: {
            message: 'Fix bug in feature Y\n\nAdded test cases'
          }
        }
      ]

      mockOctokit.rest.pulls.listCommits.mockResolvedValue({
        data: mockCommits
      } as never)

      const expectedMessages = 'abcdef1 Initial commit\n1234567 Add feature X\nfedcba0 Fix bug in feature Y'

      // Act
      const result = await getCommitMessages(mockOctokit, prNumber)

      // Assert
      expect(result).toBe(expectedMessages)
      expect(mockOctokit.rest.pulls.listCommits).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: prNumber
      })
      expect(mockCore.info).toHaveBeenCalledWith('Getting commit messages using GitHub API...')
      expect(mockCore.info).toHaveBeenCalledWith(`Commit Messages: ${expectedMessages}`)
    })

    it('should handle single commit', async () => {
      // Arrange
      const mockCommits = [
        {
          sha: 'abcdef1234567890',
          commit: {
            message: 'Single commit message'
          }
        }
      ]

      mockOctokit.rest.pulls.listCommits.mockResolvedValue({
        data: mockCommits
      } as never)

      const expectedMessages = 'abcdef1 Single commit message'

      // Act
      const result = await getCommitMessages(mockOctokit, prNumber)

      // Assert
      expect(result).toBe(expectedMessages)
    })

    it('should handle empty commit list', async () => {
      // Arrange
      mockOctokit.rest.pulls.listCommits.mockResolvedValue({
        data: []
      } as never)

      // Act
      const result = await getCommitMessages(mockOctokit, prNumber)

      // Assert
      expect(result).toBe('')
    })

    it('should extract only first line of multi-line commit messages', async () => {
      // Arrange
      const mockCommits = [
        {
          sha: 'abc123',
          commit: {
            message: 'First line\nSecond line\nThird line'
          }
        }
      ]

      mockOctokit.rest.pulls.listCommits.mockResolvedValue({
        data: mockCommits
      } as never)

      // Act
      const result = await getCommitMessages(mockOctokit, prNumber)

      // Assert
      expect(result).toBe('abc123 First line')
    })

    it('should handle API errors', async () => {
      // Arrange
      const apiError = new Error('Forbidden')
      mockOctokit.rest.pulls.listCommits.mockRejectedValue(apiError)

      // Act & Assert
      await expect(getCommitMessages(mockOctokit, prNumber))
        .rejects
        .toThrow('Failed to get commit messages: Error: Forbidden')
    })

    it('should handle commits with empty messages', async () => {
      // Arrange
      const mockCommits = [
        {
          sha: 'abc123',
          commit: {
            message: ''
          }
        },
        {
          sha: 'def456',
          commit: {
            message: 'Valid message'
          }
        }
      ]

      mockOctokit.rest.pulls.listCommits.mockResolvedValue({
        data: mockCommits
      } as never)

      // Act
      const result = await getCommitMessages(mockOctokit, prNumber)

      // Assert
      expect(result).toBe('abc123 \ndef456 Valid message')
    })
  })

  describe('updatePRDescription', () => {
    const prNumber = 123
    const description = '## Summary\nThis PR adds new features.'

    it('should update PR description successfully', async () => {
      // Arrange
      mockOctokit.rest.pulls.update.mockResolvedValue({} as never)

      // Act
      await updatePRDescription(mockOctokit, prNumber, description)

      // Assert
      expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: prNumber,
        body: description
      })
      expect(mockCore.info).toHaveBeenCalledWith('Updating PR description...')
      expect(mockCore.info).toHaveBeenCalledWith('PR description updated successfully! 🎉')
    })

    it('should handle empty description', async () => {
      // Arrange
      const emptyDescription = ''
      mockOctokit.rest.pulls.update.mockResolvedValue({} as never)

      // Act
      await updatePRDescription(mockOctokit, prNumber, emptyDescription)

      // Assert
      expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: prNumber,
        body: emptyDescription
      })
    })

    it('should handle long descriptions', async () => {
      // Arrange
      const longDescription = 'A'.repeat(10000)
      mockOctokit.rest.pulls.update.mockResolvedValue({} as never)

      // Act
      await updatePRDescription(mockOctokit, prNumber, longDescription)

      // Assert
      expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith(
        expect.objectContaining({
          body: longDescription
        })
      )
    })

    it('should handle API errors', async () => {
      // Arrange
      const apiError = new Error('Unauthorized')
      mockOctokit.rest.pulls.update.mockRejectedValue(apiError)

      // Act & Assert
      await expect(updatePRDescription(mockOctokit, prNumber, description))
        .rejects
        .toThrow('Failed to update PR description: Error: Unauthorized')
    })

    it('should handle validation errors', async () => {
      // Arrange
      const validationError = new Error('Invalid PR number')
      mockOctokit.rest.pulls.update.mockRejectedValue(validationError)

      // Act & Assert
      await expect(updatePRDescription(mockOctokit, prNumber, description))
        .rejects
        .toThrow('Failed to update PR description: Error: Invalid PR number')
    })

    it('should handle network timeout', async () => {
      // Arrange
      const timeoutError = new Error('Request timeout')
      mockOctokit.rest.pulls.update.mockRejectedValue(timeoutError)

      // Act & Assert
      await expect(updatePRDescription(mockOctokit, prNumber, description))
        .rejects
        .toThrow('Failed to update PR description: Error: Request timeout')
    })

    it('should handle special characters in description', async () => {
      // Arrange
      const specialDescription = '## Summary\n\n**Bold text** and *italic*\n\n```typescript\ncode block\n```\n\n- List item\n- Another item'
      mockOctokit.rest.pulls.update.mockResolvedValue({} as never)

      // Act
      await updatePRDescription(mockOctokit, prNumber, specialDescription)

      // Assert
      expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: prNumber,
        body: specialDescription
      })
    })
  })
})