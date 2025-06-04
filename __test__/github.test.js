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
import {
  generateDiff,
  getCommitMessages,
  updatePRDescription
} from '../src/github.js'

describe('github.js', () => {
  let mockOctokit

  beforeEach(() => {
    jest.clearAllMocks()
    mockOctokit = github.getOctokit('fake-token')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('generateDiff', () => {
    const baseSha = 'abc123'
    const headSha = 'def456'

    it('should generate diff successfully', async () => {
      // Arrange
      const expectedDiff =
        'diff --git a/file.ts b/file.ts\n+added line\n-removed line'
      const mockCompareCommitsWithBasehead =
        mockOctokit.rest.repos.compareCommitsWithBasehead
      mockCompareCommitsWithBasehead.mockResolvedValue({
        data: expectedDiff
      })

      // Act
      const result = await generateDiff(mockOctokit, baseSha, headSha)

      // Assert
      expect(result).toBe(expectedDiff)
      expect(mockCompareCommitsWithBasehead).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        basehead: `${baseSha}...${headSha}`,
        mediaType: {
          format: 'diff'
        }
      })
      expect(core.info).toHaveBeenCalledWith(
        'Generating diff using GitHub API...'
      )
      expect(core.info).toHaveBeenCalledWith(`Computed Diff: ${expectedDiff}`)
    })

    it('should handle empty diff', async () => {
      // Arrange
      const emptyDiff = ''
      const mockCompareCommitsWithBasehead =
        mockOctokit.rest.repos.compareCommitsWithBasehead
      mockCompareCommitsWithBasehead.mockResolvedValue({
        data: emptyDiff
      })

      // Act
      const result = await generateDiff(mockOctokit, baseSha, headSha)

      // Assert
      expect(result).toBe(emptyDiff)
      expect(core.info).toHaveBeenCalledWith('Computed Diff: ')
    })

    it('should handle API errors', async () => {
      // Arrange
      const apiError = new Error('API rate limit exceeded')
      const mockCompareCommitsWithBasehead =
        mockOctokit.rest.repos.compareCommitsWithBasehead
      mockCompareCommitsWithBasehead.mockRejectedValue(apiError)

      // Act & Assert
      await expect(generateDiff(mockOctokit, baseSha, headSha)).rejects.toThrow(
        'Failed to generate diff: Error: API rate limit exceeded'
      )
    })

    it('should handle network errors', async () => {
      // Arrange
      const networkError = new Error('Network timeout')
      const mockCompareCommitsWithBasehead =
        mockOctokit.rest.repos.compareCommitsWithBasehead
      mockCompareCommitsWithBasehead.mockRejectedValue(networkError)

      // Act & Assert
      await expect(generateDiff(mockOctokit, baseSha, headSha)).rejects.toThrow(
        'Failed to generate diff: Error: Network timeout'
      )
    })

    it('should handle 404 errors for missing commits', async () => {
      // Arrange
      const notFoundError = new Error('Not Found')
      const mockCompareCommitsWithBasehead =
        mockOctokit.rest.repos.compareCommitsWithBasehead
      mockCompareCommitsWithBasehead.mockRejectedValue(notFoundError)

      // Act & Assert
      await expect(generateDiff(mockOctokit, baseSha, headSha)).rejects.toThrow(
        'Failed to generate diff: Error: Not Found'
      )
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

      const mockListCommits = mockOctokit.rest.pulls.listCommits
      mockListCommits.mockResolvedValue({
        data: mockCommits
      })

      const expectedMessages =
        'abcdef1 Initial commit\n1234567 Add feature X\nfedcba0 Fix bug in feature Y'

      // Act
      const result = await getCommitMessages(mockOctokit, prNumber)

      // Assert
      expect(result).toBe(expectedMessages)
      expect(mockListCommits).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: prNumber
      })
      expect(core.info).toHaveBeenCalledWith(
        'Getting commit messages using GitHub API...'
      )
      expect(core.info).toHaveBeenCalledWith(
        `Commit Messages: ${expectedMessages}`
      )
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

      const mockListCommits = mockOctokit.rest.pulls.listCommits
      mockListCommits.mockResolvedValue({
        data: mockCommits
      })

      const expectedMessages = 'abcdef1 Single commit message'

      // Act
      const result = await getCommitMessages(mockOctokit, prNumber)

      // Assert
      expect(result).toBe(expectedMessages)
    })

    it('should handle empty commit list', async () => {
      // Arrange
      const mockListCommits = mockOctokit.rest.pulls.listCommits
      mockListCommits.mockResolvedValue({
        data: []
      })

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

      const mockListCommits = mockOctokit.rest.pulls.listCommits
      mockListCommits.mockResolvedValue({
        data: mockCommits
      })

      // Act
      const result = await getCommitMessages(mockOctokit, prNumber)

      // Assert
      expect(result).toBe('abc123 First line')
    })

    it('should handle API errors', async () => {
      // Arrange
      const apiError = new Error('Forbidden')
      const mockListCommits = mockOctokit.rest.pulls.listCommits
      mockListCommits.mockRejectedValue(apiError)

      // Act & Assert
      await expect(getCommitMessages(mockOctokit, prNumber)).rejects.toThrow(
        'Failed to get commit messages: Error: Forbidden'
      )
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

      const mockListCommits = mockOctokit.rest.pulls.listCommits
      mockListCommits.mockResolvedValue({
        data: mockCommits
      })

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
      const mockUpdate = mockOctokit.rest.pulls.update
      mockUpdate.mockResolvedValue({})

      // Act
      await updatePRDescription(mockOctokit, prNumber, description)

      // Assert
      expect(mockUpdate).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: prNumber,
        body: description
      })
      expect(core.info).toHaveBeenCalledWith('Updating PR description...')
      expect(core.info).toHaveBeenCalledWith(
        'PR description updated successfully! 🎉'
      )
    })

    it('should handle empty description', async () => {
      // Arrange
      const emptyDescription = ''
      const mockUpdate = mockOctokit.rest.pulls.update
      mockUpdate.mockResolvedValue({})

      // Act
      await updatePRDescription(mockOctokit, prNumber, emptyDescription)

      // Assert
      expect(mockUpdate).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: prNumber,
        body: emptyDescription
      })
    })

    it('should handle long descriptions', async () => {
      // Arrange
      const longDescription = 'A'.repeat(10000)
      const mockUpdate = mockOctokit.rest.pulls.update
      mockUpdate.mockResolvedValue({})

      // Act
      await updatePRDescription(mockOctokit, prNumber, longDescription)

      // Assert
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: longDescription
        })
      )
    })

    it('should handle API errors', async () => {
      // Arrange
      const apiError = new Error('Unauthorized')
      const mockUpdate = mockOctokit.rest.pulls.update
      mockUpdate.mockRejectedValue(apiError)

      // Act & Assert
      await expect(
        updatePRDescription(mockOctokit, prNumber, description)
      ).rejects.toThrow('Failed to update PR description: Error: Unauthorized')
    })

    it('should handle validation errors', async () => {
      // Arrange
      const validationError = new Error('Invalid PR number')
      const mockUpdate = mockOctokit.rest.pulls.update
      mockUpdate.mockRejectedValue(validationError)

      // Act & Assert
      await expect(
        updatePRDescription(mockOctokit, prNumber, description)
      ).rejects.toThrow(
        'Failed to update PR description: Error: Invalid PR number'
      )
    })

    it('should handle network timeout', async () => {
      // Arrange
      const timeoutError = new Error('Request timeout')
      const mockUpdate = mockOctokit.rest.pulls.update
      mockUpdate.mockRejectedValue(timeoutError)

      // Act & Assert
      await expect(
        updatePRDescription(mockOctokit, prNumber, description)
      ).rejects.toThrow(
        'Failed to update PR description: Error: Request timeout'
      )
    })

    it('should handle special characters in description', async () => {
      // Arrange
      const specialDescription =
        '## Summary\n\n**Bold text** and *italic*\n\n```typescript\ncode block\n```\n\n- List item\n- Another item'
      const mockUpdate = mockOctokit.rest.pulls.update
      mockUpdate.mockResolvedValue({})

      // Act
      await updatePRDescription(mockOctokit, prNumber, specialDescription)

      // Assert
      expect(mockUpdate).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: prNumber,
        body: specialDescription
      })
    })
  })
})
