import type { Anthropic } from '@anthropic-ai/sdk'
import { jest } from '@jest/globals'

const mockMessagesCreate = jest.fn()

export const AnthropicMock = jest.fn().mockImplementation(() => ({
  messages: {
    create: mockMessagesCreate
  }
}))

// Export named export matching the real module
export { AnthropicMock as Anthropic }

// Export for test access
export const _mockMessagesCreate = mockMessagesCreate