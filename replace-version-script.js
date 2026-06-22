import fs from 'fs';
import path from 'path';

const OLD_VER = '1.7.34';
const NEW_VER = '1.7.34';

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.includes(OLD_VER)) {
    const regex = new RegExp(OLD_VER.replace(/\./g, '\\.'), 'g');
    content = content.replace(regex, NEW_VER);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${filePath}`);
  }
}

function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'app') continue;
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else {
      if (fullPath.endsWith('.md') || fullPath.endsWith('.js') || fullPath.endsWith('.json') || fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.rules')) {
        replaceInFile(fullPath);
      }
    }
  }
}

processDirectory(process.cwd());
