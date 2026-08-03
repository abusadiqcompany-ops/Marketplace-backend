const fs = require('fs');
const path = require('path');
const ignored = new Set(['node_modules', 'tmp_backend_build', 'build-output', 'dist', '.git']);
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
const controlRegex = /<(input|textarea|select)\b[^>]*>/gi;
let total = 0;
const report = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const ids = new Set();
  const wrappedIds = new Set();
  let m;
  while ((m = labelForRegex.exec(text))) {
    ids.add(m[1]);
  }
  while ((m = labelWrapRegex.exec(text))) {
    const inner = m[1];
    const innerMatch = /<(input|textarea|select)\b[^>]*>/i.exec(inner);
    if (innerMatch) {
      const idMatch = /\bid=['\"]([^'\"]+)['\"]/.exec(inner);
      if (idMatch) wrappedIds.add(idMatch[1]);
      else wrappedIds.add('___wrapped___');
    }
  }
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    while ((match = controlRegex.exec(line))) {
      const tag = match[1];
      const attrs = match[0];
      const idMatch = /\bid=['\"]([^'\"]+)['\"]/.exec(attrs);
      const id = idMatch ? idMatch[1] : null;
      if (tag === 'input' && /\btype=['\"](hidden|button|submit|reset|image)['\"]/.test(attrs)) continue;
      if (id) {
        if (!ids.has(id) && !wrappedIds.has(id)) {
          total++;
          report.push(`${file}:${i+1}: ${attrs.trim()} -- id without label`);
        }
      } else {
        total++;
        report.push(`${file}:${i+1}: ${attrs.trim()} -- missing id/label`);
      }
    }
  }
}
console.log('files scanned', files.length);
console.log('missing label linkage', total);
console.log(report.join('\n'));
