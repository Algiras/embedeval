# Release Process

This document describes the release cycle and process for EmbedEval.

## 📦 Distribution Methods

EmbedEval is distributed via:
1. **NPM** - Primary distribution method (`npm install -g embedeval`)
2. **GitHub Releases** - Binary releases and changelogs
3. **Source** - Direct from GitHub repository

## 🔄 Release Cycle

### Versioning
We follow [Semantic Versioning](https://semver.org/):
- **MAJOR** - Breaking changes (x.0.0)
- **MINOR** - New features, backwards compatible (0.x.0)
- **PATCH** - Bug fixes, backwards compatible (0.0.x)

### Release Schedule
- **Patch releases** - As needed for bug fixes
- **Minor releases** - Monthly or when significant features are ready
- **Major releases** - As needed for breaking changes

## 🚀 Release Steps

### 1. Prepare Release

```bash
# Ensure you're on main branch
git checkout main
git pull origin main

# Run tests locally
npm test
npm run build

# Test CLI locally
node dist/cli/index.js --help
```

### 2. Update Version

```bash
# Update version in package.json
npm version patch  # or minor, major

# This will:
# - Update package.json version
# - Create a git tag
# - Commit the changes
```

### 3. Update Changelog

Add entry to `CHANGELOG.md`:

```markdown
## [1.0.1] - 2024-01-30

### Added
- New feature X

### Fixed
- Bug fix Y

### Changed
- Improvement Z
```

### 4. Push Changes

```bash
git push origin main
git push origin --tags
```

### 5. Create GitHub Release

1. Go to https://github.com/Algiras/embedeval/releases
2. Click "Draft a new release"
3. Choose the tag you just pushed
4. Add release title (e.g., "v1.0.1 - Bug fixes and improvements")
5. Add release notes from CHANGELOG.md
6. Click "Publish release"

### 6. NPM Publish (Automatic)

The GitHub Actions workflow will automatically publish to NPM when you create a release.

To verify:
```bash
npm view embedeval version
```

### 7. Verify Installation

```bash
# Test npm install
npm install -g embedeval

# Verify it works
embedeval --version
embedeval providers --list
```

## 🔧 Manual NPM Publish (if needed)

If automatic publishing fails:

```bash
# Login to NPM (if not already logged in)
npm login

# Publish
npm publish --access public
```

## 📋 Pre-Release Checklist

Before creating a release, ensure:

- [ ] All tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] CLI works (`node dist/cli/index.js --help`)
- [ ] Version updated (`npm version`)
- [ ] Changelog updated
- [ ] Documentation updated (if needed)
- [ ] GitHub Actions passing

## 🐛 Hotfix Process

For urgent bug fixes:

1. Create hotfix branch from main
   ```bash
   git checkout -b hotfix/critical-bug
   ```

2. Fix the bug and test

3. Update version as patch
   ```bash
   npm version patch
   ```

4. Push and create PR

5. Merge to main

6. Create release (follow steps above)

## 📊 Release Monitoring

Monitor these after release:
- NPM download stats: `npm view embedeval`
- GitHub Actions status
- Issue reports from users
- Performance metrics

## 🔄 Rollback Process

If a release has critical issues:

1. Deprecate version on NPM
   ```bash
   npm deprecate embedeval@1.0.1 "Critical bug found, use 1.0.2 instead"
   ```

2. Create new patch release with fix

3. Update GitHub release notes with warning

## 📝 Release Notes Template

```markdown
## What's New

### ✨ Features
- Feature 1 description
- Feature 2 description

### 🐛 Bug Fixes
- Fix 1 description
- Fix 2 description

### 📚 Documentation
- Doc improvement 1
- Doc improvement 2

### 🔧 Maintenance
- Dependency updates
- Internal improvements

## Installation

```bash
npm install -g embedeval
```

Or use the install script:
```bash
curl -fsSL https://raw.githubusercontent.com/Algiras/embedeval/main/install.sh | bash
```

## Full Changelog

See [CHANGELOG.md](https://github.com/Algiras/embedeval/blob/main/CHANGELOG.md)
```

## 🎯 Release Goals

### Short Term (v1.x)
- Stabilize core functionality
- Fix reported bugs
- Improve documentation

### Medium Term (v1.x)
- Add more providers
- Expand strategy system
- Performance optimizations

### Long Term (v2.x)
- Breaking changes if needed
- Major architecture improvements
- New evaluation methods

## 📞 Support

If you encounter issues with a release:
1. Check [Issues](https://github.com/Algiras/embedeval/issues)
2. Create new issue with version number
3. Tag it with `bug` and version label

---

**Current Version:** Check [package.json](../package.json) or run `embedeval --version`

**Latest Release:** See [GitHub Releases](https://github.com/Algiras/embedeval/releases)
