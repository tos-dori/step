const fs = require('fs');
const acorn = require('acorn');

const html = fs.readFileSync('index.html', 'utf8');
const styleMatches = [...html.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi)];
const scriptMatches = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];

const lines = [];
lines.push(`styles=${styleMatches.length}`);
lines.push(`scripts=${scriptMatches.length}`);
scriptMatches.forEach((match, index) => {
  const attrs = match[1] || '';
  const source = match[2] || '';
  const external = /\bsrc\s*=/.test(attrs);
  const module = /\btype\s*=\s*["']module["']/.test(attrs);
  lines.push(`script[${index}] external=${external} module=${module} chars=${source.length}`);
});

const appIndex = scriptMatches.findIndex((match) => /\bvar\s+KEY\s*=\s*["']step_live_v1["']/.test(match[2] || ''));
if (appIndex < 0) throw new Error('Step app script was not found');
const source = scriptMatches[appIndex][2];
const ast = acorn.parse(source, {
  ecmaVersion: 'latest',
  sourceType: 'script',
  locations: true,
  allowAwaitOutsideFunction: true
});

function label(node) {
  if (node.type === 'FunctionDeclaration') return node.id?.name || '(anonymous)';
  if (node.type === 'VariableDeclaration') {
    return node.declarations.map((decl) => {
      if (decl.id.type === 'Identifier') return decl.id.name;
      return source.slice(decl.id.start, decl.id.end).replace(/\s+/g, ' ');
    }).join(', ');
  }
  if (node.type === 'ExpressionStatement') {
    return source.slice(node.start, Math.min(node.end, node.start + 110)).replace(/\s+/g, ' ');
  }
  return '';
}

lines.push('--- app top-level outline ---');
ast.body.forEach((node, index) => {
  lines.push(`${String(index + 1).padStart(3, '0')} | ${String(node.loc.start.line).padStart(4, ' ')}-${String(node.loc.end.line).padEnd(4, ' ')} | ${node.type.padEnd(22, ' ')} | ${label(node)}`);
});

fs.writeFileSync('STEP_ARCHITECTURE_OUTLINE.tmp', lines.join('\n') + '\n');
