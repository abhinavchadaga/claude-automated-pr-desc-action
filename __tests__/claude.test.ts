import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'
import { generatePRDescription } from '../src/claude.js'

jest.unstable_mockModule('@actions/core', () => core)

describe('generatePRDescription', () => {
  const prContext = {
    prInfo: {
      number: 1,
      title: 'Add feature',
      author: 'user',
      baseSha: 'base',
      headSha: 'head',
      url: 'url'
    },
    commitMessages: 'commit1',
    diff: 'diff content'
  }

  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('generates description using fetch mock', async () => {
    const apiResponse = {
      content: [{ type: 'text', text: 'desc' }],
      usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0 }
    }
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify(apiResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }) as any
      )

    const result = await generatePRDescription('key', prContext)
    expect(result).toBe('desc')
    expect(fetchMock).toHaveBeenCalled()
  })
})
