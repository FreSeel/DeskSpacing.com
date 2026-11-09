// Run only in a child process with a heap cap and an external kill deadline.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { patchLegacyThree } from '../../scripts/legacy-three-security.js';

const [name, mode] = process.argv.slice(2);
let source = readFileSync(`node_modules/three-legacy/build/${name}`, 'utf8');
if (mode === 'patched') source = patchLegacyThree(name, source);
if (name === 'three.module.js')
  source = source.replace(
    /export \{[^\n]+\};\s*$/,
    'globalThis.THREE = { Color };',
  );
const context = vm.createContext({ console: { warn() {} } });
vm.runInContext(source, context, { timeout: 1000 });
try {
  vm.runInContext(
    `for (const name of ['rgb', 'rgba', 'hsl', 'hsla']) {
      for (const size of [50000, 200000]) {
        const input = name + '(' + ' '.repeat(size);
        new THREE.Color(input);
        new THREE.Color(input + ')');
        new THREE.Color(input + '!');
      }
    }`,
    context,
    { timeout: 100 },
  );
  process.stdout.write('completed');
} catch (error) {
  if (error.code !== 'ERR_SCRIPT_EXECUTION_TIMEOUT') throw error;
  process.stdout.write('timed out');
}
