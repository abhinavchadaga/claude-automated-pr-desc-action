import { jest } from '@jest/globals'

const mockMessagesCreate = jest.fn()

export const AnthropicMock = jest.fn().mockImplementation(() => ({
  messages: {
    create: mockMessagesCreate
  }
}))

export { AnthropicMock as Anthropic }

export const _mockMessagesCreate = mockMessagesCreate
