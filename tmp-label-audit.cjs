const fs = require('fs');
const path = require('path');
const ignored = new Set(['node_modules', 'tmp_backend_build', 'build-output', 'dist', '.git', '.github']);
const files = [];
const walk = dir => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ignored.has(entry.name)) continue;
      walk(p);
    } else if (entry.isFile() && p.endsWith('.tsx')) {
      files.push(p);
    }
  }
};
walk(process.cwd());
const labelForRegex = /<label\b[^>]*htmlFor=['\"]([^'\"]+)['\"][^>]*>/gi;
const labelWrapRegex = /<label\b[^>]*>([\s\S]*?)<\/label>/gi;
const controlRegex = /<(input|textarea|select)\b([^>]*)>/gi;
let total = 0;
const report = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const labels = new Set();
  let m;
  while ((m = labelForRegex.exec(text))) {
    labels.add(m[1]);
  }
  while ((m = labelWrapRegex.exec(text))) {
    const inner = m[1];
    const inputMatch = /<(input|textarea|select)\b[^>]*>/i.exec(inner);
    if (inputMatch) {
      const idMatch = /\bid=['\"]([^'\"]+)['\"]/i.exec(inner);
      if (idMatch) labels.add(idMatch[1]);
      else labels.add('___wrapped___');
    }
  }
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    while ((match = controlRegex.exec(line))) {
      const tag = match[1];
      const attrs = match[2];
      const idMatch = /\bid=['\"]([^'\"]+)['\"]/i.exec(attrs);
      const id = idMatch ? idMatch[1] : null;
      if (tag === 'input' && /\btype=['\"](hidden|button|submit|reset|image)['\"]/i.test(attrs)) continue;
      if (!id) {
        total++;
        report.push(`${file}:${i+1}: ${match[0].trim()} -- missing id/label`);
      } else if (!labels.has(id)) {
        total++;
        report.push(`${file}:${i+1}: ${match[0].trim()} -- id without label`);
      }
    }
  }
}
console.log('files scanned', files.length);
console.log('missing linkage', total);
console.log(report.join('\n'));
