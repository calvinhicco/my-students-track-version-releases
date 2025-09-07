const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Building macOS installer locally...');

// Step 1: Update electron.js to use Vercel deployment
const electronPath = path.join(__dirname, 'electron.js');
let electronContent = fs.readFileSync(electronPath, 'utf8');

// Replace localhost with Vercel URL
const vercelUrl = 'https://my-students-track-version-releases-ltio7x6e4.vercel.app';

// Update the development URL to use Vercel
electronContent = electronContent.replace(
  'const appURL = "http://localhost:3000"',
  `const appURL = "${vercelUrl}"`
);

fs.writeFileSync(electronPath, electronContent);

try {
  // Step 2: Install dependencies
  console.log('📦 Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });

  // Step 3: Create macOS icon first
  console.log('🎨 Creating macOS icon...');
  const iconPath = path.join(__dirname, 'public', 'logo.icns');
  if (!fs.existsSync(iconPath)) {
    // Copy PNG as temporary icon
    const pngPath = path.join(__dirname, 'public', 'logo.png');
    if (fs.existsSync(pngPath)) {
      fs.copyFileSync(pngPath, iconPath.replace('.icns', '.png'));
      console.log('📝 Using PNG icon as fallback');
    }
  }

  // Step 4: Build for macOS specifically
  console.log('🔨 Building macOS app...');
  execSync('npx electron-builder --mac --publish=never', { stdio: 'inherit' });

  console.log('✅ Build complete! Check the dist/ folder for your macOS installer.');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  console.log('\n💡 Alternative: Use your Vercel URL directly in Electron');
  console.log(`   Your app is live at: ${vercelUrl}`);
} finally {
  // Restore original electron.js
  execSync('git checkout electron.js', { stdio: 'inherit' });
}
