import fs from 'fs';
import path from 'path';

const VERSIONS_TO_REPLACE = ['1.7.35'];
const NEW_VER = '1.7.35';

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;
  for (const OLD_VER of VERSIONS_TO_REPLACE) {
    if (content.includes(OLD_VER)) {
      if (filePath.endsWith('package-lock.json') && OLD_VER === '1.7.35') {
        const regex = /"version": "1\.6\.21"/g;
        content = content.replace(regex, '"version": "1.7.35"');
      } else {
        const regex = new RegExp(OLD_VER.replace(/\./g, '\\.'), 'g');
        content = content.replace(regex, NEW_VER);
      }
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${filePath}`);
  }
}

function processDirectory(dirPath) {
  if (dirPath.includes('node_modules') || dirPath.includes('.git') || dirPath.includes('dist')) return;
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else {
      if (fullPath.endsWith('.md') || fullPath.endsWith('.js') || fullPath.endsWith('.json') || fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('AGENTS.md')) {
        replaceInFile(fullPath);
      }
    }
  }
}

processDirectory(process.cwd());
