import * as core from '@actions/core'
import * as github from '@actions/github'
import { context } from '@actions/github'
import { minimatch } from 'minimatch'

function filterDiff(diff: string, ignoredPatterns: string[]): string {
  if (ignoredPatterns.length === 0) {
    return diff
  }

  const fileSections = diff
    .split(/(?=diff --git )/g)
    .filter((section) => section.trim())
  const filteredSections: string[] = []
  let removedFilesCount = 0

  for (const section of fileSections) {
    const firstLine = section.split('\n')[0]

    if (firstLine.startsWith('diff --git a/')) {
      const afterA = firstLine.substring('diff --git a/'.length)
      const bIndex = afterA.indexOf(' b/')

      if (bIndex > 0) {
        const filePath = afterA.substring(0, bIndex)

        const shouldIgnore = ignoredPatterns.some((pattern) => {
          return minimatch(filePath, pattern)
        })

        if (shouldIgnore) {
          removedFilesCount++
          core.info(`Ignoring file: ${filePath}`)
          continue
        }

        filteredSections.push(section)
      } else {
        core.warning(`Could not parse diff header: ${firstLine}`)
      }
    } else {
      filteredSections.push(section)
    }
  }

  if (removedFilesCount > 0) {
    core.info(`Filtered out ${removedFilesCount} files from ignored patterns`)
  }

  return filteredSections.join('')
}

export async function generateDiff(
  octokit: ReturnType<typeof github.getOctokit>,
  baseSha: string,
  headSha: string,
  ignoredPatterns: string[] = []
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

    const rawDiff = response.data as unknown as string
    const filteredDiff = filterDiff(rawDiff, ignoredPatterns)

    core.info(`Raw diff lines: ${rawDiff.split('\n').length}`)
    core.info(`Filtered diff lines: ${filteredDiff.split('\n').length}`)

    return filteredDiff
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
