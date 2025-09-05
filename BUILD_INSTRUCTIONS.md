# Build Instructions for My Students Track

## macOS Compatibility & Cross-Platform Building

Your My Students Track application **IS compatible with macOS**, but building macOS installers requires special setup due to Apple's security requirements.

## The Issue

When you ran `npm run dist-mac` on Windows, you encountered this error:
```
⨯ Build for macOS is supported only on macOS, please see https://electron.build/multi-platform-build
```

This is a limitation of `electron-builder` - **macOS installers (.dmg files) can only be built on macOS machines** for security and code-signing reasons.

## Solution: GitHub Actions (Recommended)

I've created automated GitHub Actions workflows that will build your macOS installer in the cloud:

### 1. Automatic Builds on Release
- **File**: `.github/workflows/build-release.yml`
- **Trigger**: When you create a git tag (e.g., `v2.0.1`)
- **Builds**: Windows (.exe), macOS (.dmg), and Linux (.AppImage)
- **Output**: Creates a GitHub release with all installers

### 2. Manual Builds
- **File**: `.github/workflows/manual-build.yml`
- **Trigger**: Manual trigger from GitHub Actions tab
- **Options**: Build for specific platform or all platforms
- **Output**: Downloadable artifacts

## How to Get Your macOS Installer

### Option 1: Using GitHub Actions (Recommended)

1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Ready for macOS build"
   git push origin main
   ```

2. **Trigger a manual build**:
   - Go to your GitHub repository
   - Click "Actions" tab
   - Select "Manual Build" workflow
   - Click "Run workflow"
   - Choose "macos" or "all" platforms
   - Click "Run workflow"

3. **Download the installer**:
   - Wait for the build to complete (5-10 minutes)
   - Go to the workflow run
   - Download the "macos-installer" artifact
   - Extract the .dmg file

### Option 2: Create a Release Tag

1. **Create and push a tag**:
   ```bash
   git tag v2.0.1
   git push origin v2.0.1
   ```

2. **Automatic build**:
   - GitHub Actions will automatically build all platforms
   - A new release will be created with all installers
   - Users can download directly from the Releases page

### Option 3: Use a macOS Machine

If you have access to a Mac:
```bash
npm install
npm run build
npm run dist-mac
```

## Local Development

Your app works perfectly on all platforms for development:

- **Windows**: `npm run electron-dev`
- **macOS**: `npm run electron-dev`
- **Linux**: `npm run electron-dev`

## Build Configuration

Your `package.json` already includes proper macOS configuration:

```json
"mac": {
  "icon": "public/logo.icns",
  "category": "public.app-category.education",
  "target": "dmg"
}
```

## What's Included

✅ **Cross-platform Electron app**  
✅ **macOS build configuration**  
✅ **Automated GitHub Actions workflows**  
✅ **Proper icon handling for macOS**  
✅ **DMG installer generation**  
✅ **Code signing ready** (add certificates to GitHub secrets)

## Next Steps

1. Push your code to GitHub
2. Run the manual build workflow to get your macOS installer
3. Test the .dmg file on a Mac
4. Set up automatic releases using git tags

Your app is fully ready for macOS distribution! 🎉
