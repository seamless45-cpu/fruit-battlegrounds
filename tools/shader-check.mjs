/**
 * Parses every GLSL source in src/ with a real GLSL grammar so syntax errors
 * surface without a GPU.
 *
 *   node tools/shader-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { parser } from '@shaderfrog/glsl-parser';

const ROOT = new URL('../src/', import.meta.url).pathname;

/** three.js injects these automatically — declare them so the parser is happy */
const VERT_PREAMBLE = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;
uniform vec3 cameraPosition;
`;
const FRAG_PREAMBLE = `
precision highp float;
uniform mat4 viewMatrix;
uniform vec3 cameraPosition;
`;

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

/** pull out `/* glsl *​/ `...`` template literals */
const RE = /\/\*\s*glsl\s*\*\/\s*`([\s\S]*?)`/g;

let checked = 0, failed = 0;
for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = RE.exec(src))) {
    const code = m[1];
    const name = path.relative(ROOT, file) + ' #' + checked;
    const isVertex = /gl_Position/.test(code);
    // resolve ${...} interpolations (our noise helper include)
    let resolved = code;
    const includeMatch = src.match(/const NOISE_GLSL = \/\* glsl \*\/`([\s\S]*?)`/);
    if (includeMatch) resolved = resolved.replace(/\$\{NOISE_GLSL\}/g, includeMatch[1]);
    const preamble = isVertex ? VERT_PREAMBLE : FRAG_PREAMBLE;
    try {
      parser.parse(preamble + resolved, { quiet: true });
      checked++;
      console.log(`OK    ${name} (${isVertex ? 'vertex' : 'fragment'}, ${resolved.split('\n').length} lines)`);
    } catch (e) {
      failed++;
      console.log(`FAIL  ${name}\n      ${e.message.split('\n')[0]}`);
    }
  }
}

console.log(`\n${checked} shaders parsed, ${failed} failed`);
process.exit(failed ? 1 : 0);
