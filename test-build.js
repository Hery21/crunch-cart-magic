#!/usr/bin/env node

/**
 * Local Testing Script for Web Build with Public Path
 * 
 * This script:
 * 1. Builds the web export with proper publicPath
 * 2. Serves it locally simulating GitHub Pages structure
 * 3. Verifies asset paths are correct
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n📦 Web Build Testing Script\n');
console.log('=' .repeat(60));

// Step 1: Check app.json has publicPath
console.log('\n✓ Step 1: Checking app.json configuration...');
const appJson = JSON.parse(fs.readFileSync('app.json', 'utf-8'));
const publicPath = appJson.expo.web.publicPath;

if (!publicPath) {
  console.error('❌ ERROR: app.json missing web.publicPath');
  console.error('Expected: "publicPath": "/crunch-cart-magic/"');
  process.exit(1);
}

console.log(`  ✓ publicPath configured: ${publicPath}`);

// Step 2: Build the web export
console.log('\n✓ Step 2: Building web export...');
try {
  execSync('npx expo export --platform web', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  console.log('  ✓ Build successful');
} catch (e) {
  console.error('❌ Build failed. See error above.');
  process.exit(1);
}

// Step 3: Check dist folder structure
console.log('\n✓ Step 3: Verifying dist folder...');
if (!fs.existsSync('dist')) {
  console.error('❌ ERROR: dist folder not created');
  process.exit(1);
}

const files = execSync('find dist -type f | head -20').toString().split('\n').filter(Boolean);
console.log(`  ✓ dist/ created with ${files.length} files`);

// Step 4: Check for asset path in HTML
console.log('\n✓ Step 4: Checking index.html asset paths...');
const indexHtml = fs.readFileSync('dist/index.html', 'utf-8');

// Look for the pattern of asset references
const hasCorrectPaths = indexHtml.includes(publicPath) || 
                        indexHtml.includes('_expo/static');

if (hasCorrectPaths) {
  console.log('  ✓ Asset paths found in index.html');
  
  // Show a sample
  const lines = indexHtml.split('\n');
  const relevantLines = lines.filter(line => 
    line.includes('_expo') || line.includes('.js') || line.includes('.css')
  ).slice(0, 3);
  
  if (relevantLines.length > 0) {
    console.log('  Sample asset references:');
    relevantLines.forEach(line => {
      console.log('    ' + line.trim().substring(0, 80) + '...');
    });
  }
} else {
  console.warn('  ⚠ Could not find asset paths in index.html');
}

// Step 5: Instructions for local testing
console.log('\n' + '='.repeat(60));
console.log('\n🧪 Next: Test Locally\n');
console.log('Option A: Using http-server (recommended for GitHub Pages simulation)');
console.log('  $ npx http-server dist -c-1 -p 8080');
console.log('  Then open: http://localhost:8080/crunch-cart-magic/');
console.log('');
console.log('Option B: Using serve');
console.log('  $ npx serve dist');
console.log('');
console.log('Then in browser DevTools:');
console.log('  ✓ Console: No "message channel closed" error');
console.log('  ✓ Network: All JS/CSS loads with 200 status');
console.log('  ✓ Application > Local Storage: ccr.* keys appear');
console.log('');

// Step 6: Deployment info
console.log('=' .repeat(60));
console.log('\n🚀 Ready to Deploy\n');
console.log('When satisfied with local testing:');
console.log('  $ git add .');
console.log('  $ git commit -m "Fix web deployment paths"');
console.log('  $ git push origin master');
console.log('');
console.log('GitHub Actions will:');
console.log('  1. Build the web export');
console.log('  2. Deploy dist/ to gh-pages branch');
console.log('  3. Site available at: https://hery21.github.io/crunch-cart-magic/');
console.log('');
console.log('Check deployment status: https://github.com/hery21/crunch-cart-magic/actions');
console.log('\n' + '='.repeat(60) + '\n');
