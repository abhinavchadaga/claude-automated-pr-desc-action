import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

const mockContext = { repo: { owner: 'octo', repo: 'test' }, payload: {} }

jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('@actions/github', () => ({ context: mockContext }))

const { generateDiff, getCommitMessages, updatePRDescription } = await import('../src/github.js')

describe('github helpers', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  describe('generateDiff', () => {
    it('returns diff string', async () => {
      const diff = 'some diff'
      const octokit = {
        rest: {
          repos: {
            compareCommitsWithBasehead: (jest.fn() as any).mockResolvedValue({
              data: diff
            } as any)
          }
        }
      } as any

      const result = await generateDiff(octokit, 'base', 'head')
      expect(result).toBe(diff)
      expect(octokit.rest.repos.compareCommitsWithBasehead).toHaveBeenCalledWith({
        owner: 'octo',
        repo: 'test',
        basehead: 'base...head',
        mediaType: { format: 'diff' }
      })
    })

    it('throws when API fails', async () => {
      const octokit = {
        rest: {
          repos: {
            compareCommitsWithBasehead: (jest.fn() as any).mockRejectedValue(
              new Error('bad') as any
            )
          }
        }
      } as any

      await expect(generateDiff(octokit, 'a', 'b')).rejects.toThrow('Failed to generate diff: Error: bad')
    })
  })

  describe('getCommitMessages', () => {
    it('returns commit messages', async () => {
      const commits = [
        { sha: 'abcdef1', commit: { message: 'msg1\nbody' } },
        { sha: 'abcdef2', commit: { message: 'msg2' } }
      ]
      const octokit = {
        rest: {
          pulls: {
            listCommits: (jest.fn() as any).mockResolvedValue({
              data: commits
            } as any)
          }
        }
      } as any

      const result = await getCommitMessages(octokit, 5)
      expect(result).toBe('abcdef1 msg1\nabcdef2 msg2')
      expect(octokit.rest.pulls.listCommits).toHaveBeenCalledWith({
        owner: 'octo',
        repo: 'test',
        pull_number: 5
      })
    })

    it('throws when API fails', async () => {
      const octokit = {
        rest: {
          pulls: {
            listCommits: (jest.fn() as any).mockRejectedValue(
              new Error('oops') as any
            )
          }
        }
      } as any
      await expect(getCommitMessages(octokit, 1)).rejects.toThrow('Failed to get commit messages: Error: oops')
    })
  })

  describe('updatePRDescription', () => {
    it('updates description via octokit', async () => {
      const octokit = {
        rest: {
          pulls: {
            update: (jest.fn() as any).mockResolvedValue({} as any)
          }
        }
      } as any
      await updatePRDescription(octokit, 3, 'body')
      expect(octokit.rest.pulls.update).toHaveBeenCalledWith({
        owner: 'octo',
        repo: 'test',
        pull_number: 3,
        body: 'body'
      })
    })

    it('throws when update fails', async () => {
      const octokit = {
        rest: {
          pulls: {
            update: (jest.fn() as any).mockRejectedValue(new Error('no') as any)
          }
        }
      } as any
      await expect(updatePRDescription(octokit, 2, 'x')).rejects.toThrow('Failed to update PR description: Error: no')
    })
  })
})
