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
      const expectedDiff =
        'diff --git a/file.ts b/file.ts\n+added line\n-removed line'
      const mockCompareCommitsWithBasehead =
        mockOctokit.rest.repos.compareCommitsWithBasehead
      mockCompareCommitsWithBasehead.mockResolvedValue({
        data: expectedDiff
      })

      const result = await generateDiff(mockOctokit, baseSha, headSha)

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
      expect(core.info).toHaveBeenCalledWith(`Raw diff lines: 3`)
      expect(core.info).toHaveBeenCalledWith(`Filtered diff lines: 3`)
    })

    it('should handle empty diff', async () => {
      const emptyDiff = ''
      const mockCompareCommitsWithBasehead =
        mockOctokit.rest.repos.compareCommitsWithBasehead
      mockCompareCommitsWithBasehead.mockResolvedValue({
        data: emptyDiff
      })

      const result = await generateDiff(mockOctokit, baseSha, headSha)

      expect(result).toBe(emptyDiff)
      expect(core.info).toHaveBeenCalledWith('Raw diff lines: 1')
      expect(core.info).toHaveBeenCalledWith('Filtered diff lines: 1')
    })

    it('should handle API errors', async () => {
      const apiError = new Error('API rate limit exceeded')
      const mockCompareCommitsWithBasehead =
        mockOctokit.rest.repos.compareCommitsWithBasehead
      mockCompareCommitsWithBasehead.mockRejectedValue(apiError)

      await expect(generateDiff(mockOctokit, baseSha, headSha)).rejects.toThrow(
        'Failed to generate diff: Error: API rate limit exceeded'
      )
    })

    it('should handle network errors', async () => {
      const networkError = new Error('Network timeout')
      const mockCompareCommitsWithBasehead =
        mockOctokit.rest.repos.compareCommitsWithBasehead
      mockCompareCommitsWithBasehead.mockRejectedValue(networkError)

      await expect(generateDiff(mockOctokit, baseSha, headSha)).rejects.toThrow(
        'Failed to generate diff: Error: Network timeout'
      )
    })

    it('should handle 404 errors for missing commits', async () => {
      const notFoundError = new Error('Not Found')
      const mockCompareCommitsWithBasehead =
        mockOctokit.rest.repos.compareCommitsWithBasehead
      mockCompareCommitsWithBasehead.mockRejectedValue(notFoundError)

      await expect(generateDiff(mockOctokit, baseSha, headSha)).rejects.toThrow(
        'Failed to generate diff: Error: Not Found'
      )
    })

    it('should filter out ignored patterns', async () => {
      const diffWithBuildFiles = `diff --git a/src/file.ts b/src/file.ts
index 1234567..abcdefg 100644
--- a/src/file.ts
+++ b/src/file.ts
@@ -1,3 +1,4 @@
 function test() {
+  console.log('new line')
   return true
 }
diff --git a/dist/bundle.js b/dist/bundle.js
index 9876543..fedcba9 100644
--- a/dist/bundle.js
+++ b/dist/bundle.js
@@ -1,1000 +1,1000 @@
 // Minified build file with thousands of lines
+// More minified content
diff --git a/package.json b/package.json
index 1111111..2222222 100644
--- a/package.json
+++ b/package.json
@@ -1,5 +1,6 @@
 {
   "name": "test",
+  "version": "1.0.1",
   "scripts": {
     "build": "rollup"
   }
`

      const mockCompareCommitsWithBasehead =
        mockOctokit.rest.repos.compareCommitsWithBasehead
      mockCompareCommitsWithBasehead.mockResolvedValue({
        data: diffWithBuildFiles
      })

      const result = await generateDiff(mockOctokit, baseSha, headSha, [
        'dist/**'
      ])

      expect(result).not.toContain('dist/bundle.js')
      expect(result).toContain('src/file.ts')
      expect(result).toContain('package.json')
      expect(core.info).toHaveBeenCalledWith('Ignoring file: dist/bundle.js')
      expect(core.info).toHaveBeenCalledWith(
        'Filtered out 1 files from ignored patterns'
      )
    })

    it('should handle multiple ignored patterns', async () => {
      const diffWithMultipleFiles = `diff --git a/src/file.ts b/src/file.ts
--- a/src/file.ts
+++ b/src/file.ts
@@ -1 +1,2 @@
 test
+new line
diff --git a/dist/bundle.js b/dist/bundle.js
--- a/dist/bundle.js
+++ b/dist/bundle.js
@@ -1 +1,2 @@
 minified
+more minified
diff --git a/node_modules/package/index.js b/node_modules/package/index.js
--- a/node_modules/package/index.js
+++ b/node_modules/package/index.js
@@ -1 +1,2 @@
 dependency
+updated dependency`

      const mockCompareCommitsWithBasehead =
        mockOctokit.rest.repos.compareCommitsWithBasehead
      mockCompareCommitsWithBasehead.mockResolvedValue({
        data: diffWithMultipleFiles
      })

      const result = await generateDiff(mockOctokit, baseSha, headSha, [
        'dist/**',
        'node_modules/**'
      ])

      expect(result).not.toContain('dist/bundle.js')
      expect(result).not.toContain('node_modules/package/index.js')
      expect(result).toContain('src/file.ts')
    })

    it('should not filter when no ignored patterns provided', async () => {
      const expectedDiff = `diff --git a/dist/file.js b/dist/file.js
+added line
-removed line`
      const mockCompareCommitsWithBasehead =
        mockOctokit.rest.repos.compareCommitsWithBasehead
      mockCompareCommitsWithBasehead.mockResolvedValue({
        data: expectedDiff
      })

      const result = await generateDiff(mockOctokit, baseSha, headSha, [])

      expect(result).toBe(expectedDiff)
      expect(result).toContain('dist/file.js')
    })

    it('should filter files by specific file pattern', async () => {
      const diffWithMinifiedFiles = `diff --git a/src/file.ts b/src/file.ts
--- a/src/file.ts
+++ b/src/file.ts
@@ -1 +1,2 @@
 function test() {}
+console.log('added')
diff --git a/dist/bundle.min.js b/dist/bundle.min.js
--- a/dist/bundle.min.js
+++ b/dist/bundle.min.js
@@ -1 +1,2 @@
 minified content
+more minified
diff --git a/src/utils.min.js b/src/utils.min.js
--- a/src/utils.min.js
+++ b/src/utils.min.js
@@ -1 +1,2 @@
 utility functions
+more utilities`

      const mockCompareCommitsWithBasehead =
        mockOctokit.rest.repos.compareCommitsWithBasehead
      mockCompareCommitsWithBasehead.mockResolvedValue({
        data: diffWithMinifiedFiles
      })

      const result = await generateDiff(mockOctokit, baseSha, headSha, [
        '**/*.min.js'
      ])

      expect(result).toContain('src/file.ts')
      expect(result).not.toContain('bundle.min.js')
      expect(result).not.toContain('utils.min.js')
      expect(core.info).toHaveBeenCalledWith(
        'Ignoring file: dist/bundle.min.js'
      )
      expect(core.info).toHaveBeenCalledWith('Ignoring file: src/utils.min.js')
    })

    it('should filter files by mixed patterns', async () => {
      const diffWithMixedFiles = `diff --git a/src/component.tsx b/src/component.tsx
--- a/src/component.tsx
+++ b/src/component.tsx
@@ -1 +1,2 @@
 export default function() {}
+added feature
diff --git a/dist/bundle.js b/dist/bundle.js
--- a/dist/bundle.js
+++ b/dist/bundle.js
@@ -1 +1,2 @@
 bundled code
+more code
diff --git a/coverage/report.html b/coverage/report.html
--- a/coverage/report.html
+++ b/coverage/report.html
@@ -1 +1,2 @@
 <html>coverage</html>
+more coverage
diff --git a/temp.log b/temp.log
--- a/temp.log
+++ b/temp.log
@@ -1 +1,2 @@
 log entry
+new log`

      const mockCompareCommitsWithBasehead =
        mockOctokit.rest.repos.compareCommitsWithBasehead
      mockCompareCommitsWithBasehead.mockResolvedValue({
        data: diffWithMixedFiles
      })

      const result = await generateDiff(mockOctokit, baseSha, headSha, [
        'dist/**',
        'coverage/**',
        '*.log'
      ])

      expect(result).toContain('src/component.tsx')
      expect(result).not.toContain('dist/bundle.js')
      expect(result).not.toContain('coverage/report.html')
      expect(result).not.toContain('temp.log')
    })

    it('should handle malformed diff headers gracefully', async () => {
      const diffWithMalformedHeaders = `diff --git a/normal/file.ts b/normal/file.ts
index 1234567..abcdefg 100644
--- a/normal/file.ts
+++ b/normal/file.ts
@@ -1 +1,2 @@
 normal content
+added line
diff --git a/file/path missing-b-section
index 1234567..abcdefg 100644
--- a/some/file
+++ b/some/file
@@ -1 +1,2 @@
 content with malformed header
+another line`

      const mockCompareCommitsWithBasehead =
        mockOctokit.rest.repos.compareCommitsWithBasehead
      mockCompareCommitsWithBasehead.mockResolvedValue({
        data: diffWithMalformedHeaders
      })

      jest.clearAllMocks()

      const result = await generateDiff(mockOctokit, baseSha, headSha, [
        '*.fake'
      ])

      expect(result).toContain('normal/file.ts')
      expect(result).not.toContain('content with malformed header')
      expect(core.warning).toHaveBeenCalledWith(
        'Could not parse diff header: diff --git a/file/path missing-b-section'
      )
    })

    it('should include non-diff content in output', async () => {
      const diffWithNonDiffContent = `Some header text
or metadata that doesn't start with diff --git

diff --git a/normal/file.ts b/normal/file.ts
index 1234567..abcdefg 100644
--- a/normal/file.ts
+++ b/normal/file.ts
@@ -1 +1,2 @@
 normal content
+added line

Some footer text or metadata`

      const mockCompareCommitsWithBasehead =
        mockOctokit.rest.repos.compareCommitsWithBasehead
      mockCompareCommitsWithBasehead.mockResolvedValue({
        data: diffWithNonDiffContent
      })

      const result = await generateDiff(mockOctokit, baseSha, headSha, [
        '*.fake'
      ])

      expect(result).toContain('Some header text')
      expect(result).toContain('normal/file.ts')
      expect(result).toContain('Some footer text')
    })
  })

  describe('getCommitMessages', () => {
    const prNumber = 123

    it('should get commit messages successfully', async () => {
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

      const result = await getCommitMessages(mockOctokit, prNumber)

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

      const result = await getCommitMessages(mockOctokit, prNumber)

      expect(result).toBe(expectedMessages)
    })

    it('should handle empty commit list', async () => {
      const mockListCommits = mockOctokit.rest.pulls.listCommits
      mockListCommits.mockResolvedValue({
        data: []
      })

      const result = await getCommitMessages(mockOctokit, prNumber)

      expect(result).toBe('')
    })

    it('should extract only first line of multi-line commit messages', async () => {
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

      const result = await getCommitMessages(mockOctokit, prNumber)

      expect(result).toBe('abc123 First line')
    })

    it('should handle API errors', async () => {
      const apiError = new Error('Forbidden')
      const mockListCommits = mockOctokit.rest.pulls.listCommits
      mockListCommits.mockRejectedValue(apiError)

      await expect(getCommitMessages(mockOctokit, prNumber)).rejects.toThrow(
        'Failed to get commit messages: Error: Forbidden'
      )
    })

    it('should handle commits with empty messages', async () => {
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

      const result = await getCommitMessages(mockOctokit, prNumber)

      expect(result).toBe('abc123 \ndef456 Valid message')
    })
  })

  describe('updatePRDescription', () => {
    const prNumber = 123
    const description = '## Summary\nThis PR adds new features.'

    it('should update PR description successfully', async () => {
      const mockUpdate = mockOctokit.rest.pulls.update
      mockUpdate.mockResolvedValue({})

      await updatePRDescription(mockOctokit, prNumber, description)

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
      const emptyDescription = ''
      const mockUpdate = mockOctokit.rest.pulls.update
      mockUpdate.mockResolvedValue({})

      await updatePRDescription(mockOctokit, prNumber, emptyDescription)

      expect(mockUpdate).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: prNumber,
        body: emptyDescription
      })
    })

    it('should handle long descriptions', async () => {
      const longDescription = 'A'.repeat(10000)
      const mockUpdate = mockOctokit.rest.pulls.update
      mockUpdate.mockResolvedValue({})

      await updatePRDescription(mockOctokit, prNumber, longDescription)

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: longDescription
        })
      )
    })

    it('should handle API errors', async () => {
      const apiError = new Error('Unauthorized')
      const mockUpdate = mockOctokit.rest.pulls.update
      mockUpdate.mockRejectedValue(apiError)

      await expect(
        updatePRDescription(mockOctokit, prNumber, description)
      ).rejects.toThrow('Failed to update PR description: Error: Unauthorized')
    })

    it('should handle validation errors', async () => {
      const validationError = new Error('Invalid PR number')
      const mockUpdate = mockOctokit.rest.pulls.update
      mockUpdate.mockRejectedValue(validationError)

      await expect(
        updatePRDescription(mockOctokit, prNumber, description)
      ).rejects.toThrow(
        'Failed to update PR description: Error: Invalid PR number'
      )
    })

    it('should handle network timeout', async () => {
      const timeoutError = new Error('Request timeout')
      const mockUpdate = mockOctokit.rest.pulls.update
      mockUpdate.mockRejectedValue(timeoutError)

      await expect(
        updatePRDescription(mockOctokit, prNumber, description)
      ).rejects.toThrow(
        'Failed to update PR description: Error: Request timeout'
      )
    })

    it('should handle special characters in description', async () => {
      const specialDescription =
        '## Summary\n\n**Bold text** and *italic*\n\n```typescript\ncode block\n```\n\n- List item\n- Another item'
      const mockUpdate = mockOctokit.rest.pulls.update
      mockUpdate.mockResolvedValue({})

      await updatePRDescription(mockOctokit, prNumber, specialDescription)

      expect(mockUpdate).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: prNumber,
        body: specialDescription
      })
    })
  })
})
