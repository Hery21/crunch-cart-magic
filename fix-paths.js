#!/usr/bin/env node

/**
 * Fix asset paths in dist folder for GitHub Pages subdirectory deployment
 * Replaces /_expo with /crunch-cart-magic/_expo
 */

const fs = require('fs');
const path = require('path');

const SUBDIRECTORY = '/crunch-cart-magic';
const distDir = path.join(__dirname, 'dist');

function fixPathsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;

    // Fix /_expo paths
    if (content.includes('/_expo')) {
      content = content.replace(/\/_expo/g, `${SUBDIRECTORY}/_expo`);
      modified = true;
    }

    // Fix /favicon paths
    if (content.includes('href="/favicon')) {
      content = content.replace(/href="\/favicon/g, `href="${SUBDIRECTORY}/favicon`);
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    }
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err.message);
  }
  return false;
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (file.endsWith('.html') || file.endsWith('.js')) {
      const fixed = fixPathsInFile(fullPath);
      if (fixed) {
        console.log(`✓ Fixed: ${path.relative(distDir, fullPath)}`);
      }
    }
  }
}

if (!fs.existsSync(distDir)) {
  console.error('❌ dist folder not found. Build first with: npx expo export --platform web');
  process.exit(1);
}

console.log(`\n🔧 Fixing asset paths for GitHub Pages subdirectory: ${SUBDIRECTORY}\n`);

walkDir(distDir);

// Verify the fix
const indexHtml = path.join(distDir, 'index.html');
if (fs.existsSync(indexHtml)) {
  const content = fs.readFileSync(indexHtml, 'utf-8');
  if (content.includes(`${SUBDIRECTORY}/_expo`)) {
    console.log(`\n✅ Success! Asset paths fixed.\n`);
    console.log('Sample paths:');
    const matches = content.match(/\/crunch-cart-magic\/[^"\s]*/g);
    if (matches) {
      matches.slice(0, 3).forEach(match => {
        console.log(`  ${match}`);
      });
    }
  } else {
    console.log('\n⚠️  Warning: Paths may not have been fixed correctly');
  }
}

console.log('');
