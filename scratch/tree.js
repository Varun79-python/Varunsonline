const fs = require('fs');
const path = require('path');

const ignoreDirs = new Set(['node_modules', '.git', '.next', '.vercel', '.opencode', 'android', 'scratch', 'public']);

function getTree(dir, prefix = '') {
  const files = fs.readdirSync(dir);
  let output = '';
  files.forEach((file, index) => {
    const isLast = index === files.length - 1;
    const fullPath = path.join(dir, file);
    let isDir = false;
    try {
      isDir = fs.statSync(fullPath).isDirectory();
    } catch (e) {
      return;
    }
    
    if (isDir && ignoreDirs.has(file)) return;
    
    output += `${prefix}${isLast ? '└── ' : '├── '}${file}\n`;
    if (isDir) {
      output += getTree(fullPath, prefix + (isLast ? '    ' : '│   '));
    }
  });
  return output;
}

console.log('varunsonline');
console.log(getTree('.'));
