import * as core from '@actions/core'
import { context } from '@actions/github'
import { PRInfo, Config } from './types.js'

export function validatePullRequestEvent(): void {
  if (context.eventName !== 'pull_request') {
    throw new Error('This action can only be used in pull request events.')
  }
}

export function validatePullRequestAction(): void {
  const action = context.payload.action
  if (!action || !['opened', 'synchronize', 'reopened'].includes(action)) {
    core.info(`Skipping action for PR action: ${action || 'unknown'}`)
    process.exit(0)
  }
}

export function extractPRInfo(): PRInfo {
  const pr = context.payload.pull_request
  if (!pr) {
    throw new Error('No pull request found in context')
  }

  if (
    !pr.title ||
    !pr.user?.login ||
    !pr.base?.sha ||
    !pr.head?.sha ||
    !pr.html_url
  ) {
    throw new Error(
      'Required PR fields are missing (title, author, base SHA, head SHA, or URL)'
    )
  }

  return {
    number: pr.number,
    title: pr.title!,
    author: pr.user!.login!,
    baseSha: pr.base!.sha!,
    headSha: pr.head!.sha!,
    url: pr.html_url!
  }
}

export function getConfig(): Config {
  const anthropicApiKey = core.getInput('anthropic-api-key')
  const githubToken = core.getInput('github-token')
  const ignorePatternsInput = core.getInput('ignore-patterns')

  if (!anthropicApiKey) {
    throw new Error(
      'Anthropic API key not found. Please set the anthropic-api-key input or ANTHROPIC_API_KEY environment variable.'
    )
  }

  if (!githubToken) {
    throw new Error(
      'GitHub token not found. Please set the github-token input or GITHUB_TOKEN environment variable.'
    )
  }

  const ignoredPatterns = ignorePatternsInput
    .split(',')
    .map((pattern: string) => pattern.trim())
    .filter((pattern: string) => pattern.length > 0)

  if (ignoredPatterns.length > 0) {
    core.info(`Ignoring patterns: ${ignoredPatterns.join(', ')}`)
  }

  return {
    anthropicApiKey,
    githubToken,
    ignoredPatterns
  }
}
