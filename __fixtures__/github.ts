import type * as github from '@actions/github'
import { jest } from '@jest/globals'

export const context = {
  eventName: '',
  repo: {
    owner: 'test-owner',
    repo: 'test-repo'
  },
  payload: {}
}

export const getOctokit = jest.fn<typeof github.getOctokit>().mockReturnValue({
  rest: {
    repos: {
      compareCommitsWithBasehead: jest.fn()
    },
    pulls: {
      listCommits: jest.fn(),
      update: jest.fn()
    }
  }
} as any)
