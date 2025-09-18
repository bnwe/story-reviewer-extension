---
inclusion: always
---

# Git Workflow Rules

## Commit Guidelines

### When to Commit
- Create a git commit after completing each discrete task or feature implementation
- Commit working, tested code that doesn't break existing functionality
- Make atomic commits that represent a single logical change

### Commit Message Format
```
<type>: <description>

[optional body]

Commit message created by Kiro
```

### Commit Types
- **feat**: New feature implementation
- **fix**: Bug fixes
- **refactor**: Code refactoring without functional changes
- **test**: Adding or updating tests
- **docs**: Documentation updates
- **style**: Code formatting, CSS changes
- **chore**: Build process, dependency updates

### Commit Message Rules
- Use present tense ("Add feature" not "Added feature")
- Keep first line under 50 characters
- Capitalize first letter of description
- No period at end of first line
- Always append "Commit message created by Kiro" on a new line

### Examples
```
feat: Add refresh button to feedback popup

Implements user-requested refresh functionality to reload
feedback content without closing the popup window.

Commit message created by Kiro
```

```
fix: Resolve content extraction for new Azure DevOps layout

Updates DOM selectors to handle recent Azure DevOps UI changes
that were breaking story content extraction.

Commit message created by Kiro
```

## What NOT to Commit
- `node_modules/` directory
- `dist/` build artifacts
- Browser extension packages (`.zip`, `.xpi`)
- IDE-specific files (already in `.gitignore`)
- Temporary or debug files