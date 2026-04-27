name: Pull Request
description: Template for pull requests
body:
  - type: markdown
    attributes:
      value: |
        ## 🚀 Pull Request Guidelines
        Thank you for contributing! Please ensure your PR follows our [contributing guidelines](../CONTRIBUTING.md).

  - type: textarea
    id: description
    attributes:
      label: Description
      description: Brief description of changes and their purpose.
      placeholder: Describe what this PR does and why it's needed...
    validations:
      required: true

  - type: dropdown
    id: type
    attributes:
      label: Type of Change
      description: What type of change is this?
      options:
        - 🐛 Bug fix
        - ✨ New feature
        - 💥 Breaking change
        - 📝 Documentation update
        - 🎨 Refactoring
        - ⚡ Performance improvement
        - 🔧 Configuration change
    validations:
      required: true

  - type: textarea
    id: changes
    attributes:
      label: Changes Made
      description: List the key changes made in this PR.
      placeholder: |
        - Added patient search functionality
        - Implemented responsive design
        - Fixed authentication bug
        - Updated API documentation

  - type: textarea
    id: testing
    attributes:
      label: Testing
      description: How did you test these changes?
      placeholder: |
        - Added unit tests for new functions
        - Tested manually in Chrome and Firefox
        - Verified API endpoints work correctly
        - Checked mobile responsiveness

  - type: dropdown
    id: components
    attributes:
      label: Components Affected
      description: Which components are affected by this change?
      multiple: true
      options:
        - Frontend
        - Backend
        - Smart Contracts
        - API
        - Database
        - Documentation
        - Tests
        - CI/CD
    validations:
      required: true

  - type: checkboxes
    id: checks
    attributes:
      label: Pre-flight Checks
      description: Please confirm you've completed the following
      options:
        - label: I have read the contributing guidelines
          required: true
        - label: My code follows the project's style guidelines
          required: true
        - label: I have performed a self-review of my code
          required: true
        - label: I have commented my code where necessary
          required: true
        - label: I have added tests that prove my fix is effective or that my feature works
          required: true
        - label: New and existing unit tests pass locally with my changes
          required: true
        - label: Any dependent changes have been merged and published
          required: true

  - type: checkboxes
    id: breaking
    attributes:
      label: Breaking Changes
      description: Does this PR introduce breaking changes?
      options:
        - label: This PR contains breaking changes
          required: false

  - type: textarea
    id: breaking-details
    attributes:
      label: Breaking Changes Details
      description: If this PR contains breaking changes, please describe them.
      placeholder: Describe what will break and how to migrate...

  - type: textarea
    id: screenshots
    attributes:
      label: Screenshots / Videos
      description: Add screenshots or videos to demonstrate your changes.
      placeholder: Drag and drop files here...

  - type: textarea
    id: additional
    attributes:
      label: Additional Context
      description: Add any other context about this PR here.
      placeholder: Any additional information...

  - type: markdown
    attributes:
      value: |
        ## 📋 Review Process
        - This PR will be reviewed by the maintainers
        - Please respond to review comments promptly
        - Ensure all CI checks pass
        - Maintain a respectful and constructive tone

        ## 🏷️ Labels
        Maintainers will add appropriate labels:
        - `ready for review` - Ready for maintainer review
        - `changes requested` - Changes needed before merge
        - `approved` - Approved for merge
        - `wip` - Work in progress
