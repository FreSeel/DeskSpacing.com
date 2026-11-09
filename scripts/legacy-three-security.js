import { createHash } from 'node:crypto';

// Backport the whitespace fix from three.js PR #21143 (r125) to r116.
// Keep the original alpha captures and all other historical engine behavior.
// https://github.com/mrdoob/three.js/pull/21143
// Source hashes are from the locked three@0.116.1 npm distribution.
const sources = {
  'three.min.js':
    'c498fdc7c81b2fd10dc5fc80ef14fdc4d9bf11b2b91969786dd4aa85b4b68966',
  'three.module.js':
    '8d7f92a7211b3270fcb75b71054058d4f91df4f9ccb79ccc99b710cb8f8ebc40',
};

export function patchLegacyThree(name, contents) {
  if (!Object.hasOwn(sources, name)) return contents;
  const source = contents.toString();
  if (createHash('sha256').update(source).digest('hex') !== sources[name])
    throw new Error(`Legacy Three.js security patch: unexpected ${name}`);

  const percent = name === 'three.min.js' ? '%' : String.raw`\%`;
  const replacements = [
    [
      String.raw`/^((?:rgb|hsl)a?)\(\s*([^\)]*)\)/`,
      String.raw`/^((?:rgb|hsl)a?)\(([^\)]*)\)/`,
    ],
    [String.raw`/^(\d+)\s*,`, String.raw`/^\s*(\d+)\s*,`],
    [String.raw`/^(\d+)${percent}\s*,`, String.raw`/^\s*(\d+)${percent}\s*,`],
    [
      String.raw`/^([0-9]*\.?[0-9]+)\s*,`,
      String.raw`/^\s*([0-9]*\.?[0-9]+)\s*,`,
    ],
  ];
  let patched = source;
  for (const [before, after] of replacements) {
    if (patched.split(before).length !== 2)
      throw new Error(
        `Legacy Three.js security patch: missing/ambiguous pattern in ${name}`,
      );
    patched = patched.replace(before, after);
  }
  return `/* DeskSpacing r116 Color.setStyle security backport: GHSA-fq6p-x6j3-cmmq. See THIRD_PARTY_NOTICES.md. */\n${patched}`;
}
