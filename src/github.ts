import * as core from '@actions/core'
import * as github from '@actions/github'
import { context } from '@actions/github'

export async function generateDiff(
  octokit: ReturnType<typeof github.getOctokit>,
  baseSha: string,
  headSha: string
): Promise<string> {
  try {
    core.info('Generating diff using GitHub API...')
    const response = await octokit.rest.repos.compareCommitsWithBasehead({
      owner: context.repo.owner,
      repo: context.repo.repo,
      basehead: `${baseSha}...${headSha}`,
      mediaType: {
        format: 'diff'
      }
    })

    const diff = response.data as unknown as string
    core.info(`Computed Diff: ${diff}`)

    return diff
  } catch (error) {
    throw new Error(`Failed to generate diff: ${error}`)
  }
}

export async function getCommitMessages(
  octokit: ReturnType<typeof github.getOctokit>,
  prNumber: number
): Promise<string> {
  try {
    core.info('Getting commit messages using GitHub API...')
    const response = await octokit.rest.pulls.listCommits({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: prNumber
    })

    const commitMessages = response.data
      .map(
        (commit) =>
          `${commit.sha.substring(0, 7)} ${commit.commit.message.split('\n')[0]}`
      )
      .join('\n')

    core.info(`Commit Messages: ${commitMessages}`)

    return commitMessages
  } catch (error) {
    throw new Error(`Failed to get commit messages: ${error}`)
  }
}

/**
 * Update PR description using GitHub API
 */
export async function updatePRDescription(
  octokit: ReturnType<typeof github.getOctokit>,
  prNumber: number,
  description: string
): Promise<void> {
  try {
    core.info('Updating PR description...')
    await octokit.rest.pulls.update({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: prNumber,
      body: description
    })

    core.info('PR description updated successfully! 🎉')
  } catch (error) {
    throw new Error(`Failed to update PR description: ${error}`)
  }
}
