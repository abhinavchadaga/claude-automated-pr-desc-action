# PR Description Generator

[![GitHub Super-Linter](https://github.com/abhinavchadaga/claude-automated-pr-desc-action/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/abhinavchadaga/claude-automated-pr-desc-action/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/abhinavchadaga/claude-automated-pr-desc-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/abhinavchadaga/claude-automated-pr-desc-action/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/abhinavchadaga/claude-automated-pr-desc-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/abhinavchadaga/claude-automated-pr-desc-action/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

A GitHub Action that automatically generates comprehensive pull request
descriptions using Claude AI. This action analyzes your PR's code changes,
commit messages, and metadata to create professional, structured descriptions
that improve code review efficiency.

## Features

- **AI-Powered Analysis**: Uses Claude 3.5 Haiku to analyze code diffs and
  commit messages
- **Smart Filtering**: Configurable ignore patterns to exclude generated files,
  dependencies, etc.
- **Token Optimization**: Implements caching to reduce API costs
- **Zero Configuration**: Works out of the box with minimal setup

## Usage

### Basic Setup

Add this action to your workflow file (e.g.,
`.github/workflows/pr-description.yml`):

```yaml
name: Generate PR Description
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  generate-description:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - name: Generate PR Description
        uses: abhinavchadaga/claude-automated-pr-desc-action@v1
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Advanced Configuration

```yaml
- name: Generate PR Description
  uses: abhinavchadaga/claude-automated-pr-desc-action@v1
  with:
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    ignore-patterns: 'dist/**,**/*.min.js,node_modules/**,**/*.lock'
```

## Inputs

| Input               | Description                                            | Required | Default               |
| ------------------- | ------------------------------------------------------ | -------- | --------------------- |
| `anthropic-api-key` | Anthropic API key for Claude                           | Yes      | -                     |
| `github-token`      | GitHub token for API access                            | Yes      | `${{ github.token }}` |
| `ignore-patterns`   | Comma-separated glob patterns to exclude from analysis | No       | `''`                  |

## Outputs

| Output        | Description                  |
| ------------- | ---------------------------- |
| `description` | The generated PR description |

## Setup Instructions

### 1. Get an Anthropic API Key

1. Sign up at [Anthropic Console](https://console.anthropic.com/)
2. Create a new API key
3. Add it to your repository secrets as `ANTHROPIC_API_KEY`

### 2. Configure Repository Permissions

Ensure your workflow has the following permissions:

```yaml
permissions:
  contents: read
  pull-requests: write
```

### 3. Add the Workflow

Create `.github/workflows/pr-description.yml` with the configuration above.

## Example Output

The action generates descriptions in this format:

```markdown
----------------------------------------------------------------------

## Summary
Adds user authentication system with JWT tokens and password hashing for secure login functionality.

## Changes Made  
- Implemented JWT-based authentication middleware
- Added password hashing with bcrypt
- Created user login and registration endpoints
- Updated database schema for user credentials
- Added input validation for authentication forms

---

---
```
