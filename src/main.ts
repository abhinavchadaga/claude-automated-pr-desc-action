import * as core from '@actions/core'
import {
  validatePullRequestEvent,
  validatePullRequestAction,
  extractPRInfo,
  getConfig
} from './validation.js'
import {
  generateDiff,
  getCommitMessages,
  updatePRDescription
} from './github.js'
import { generatePRDescription } from './claude.js'
import { PRContext } from './types.js'

import github from '@actions/github'

export async function run(): Promise<void> {
  try {
    core.info('Starting PR description automation...')

    validatePullRequestEvent()
    validatePullRequestAction()
    const config = getConfig()
    const prInfo = extractPRInfo()

    core.info(`Analyzing PR #${prInfo.number}: ${prInfo.title}`)
    core.info(`Author: ${prInfo.author}`)
    core.info(`Base SHA: ${prInfo.baseSha}`)
    core.info(`Head SHA: ${prInfo.headSha}`)

    const octokit = github.getOctokit(config.githubToken)

    const [diff, commitMessages] = await Promise.all([
      generateDiff(
        octokit,
        prInfo.baseSha,
        prInfo.headSha,
        config.ignoredPatterns
      ),
      getCommitMessages(octokit, prInfo.number)
    ])

    const prContext: PRContext = {
      prInfo,
      commitMessages,
      diff
    }

    const newDescription = await generatePRDescription(
      config.anthropicApiKey,
      prContext
    )

    await updatePRDescription(octokit, prInfo.number, newDescription)

    core.info(`PR description updated successfully! View at: ${prInfo.url}`)
    core.setOutput('description', newDescription)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    core.error(`Error: ${errorMessage}`)
    core.setFailed(errorMessage)
  }
}
