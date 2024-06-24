import * as semverUtils from 'semver-utils'

function nthIndexOfChar(haystack: string, needle: string, n: number) {
  let count = 0;

  for (let i = 0; i < haystack.length; i++) {
    if (haystack[i] === needle) {
      count++;
    }

    if (count === n) {
      return i;
    }
  }

  return -1;
}

export function parseSemverSync(versionString: string) {
  if (!versionString) {
    return null;
  }

  const i = nthIndexOfChar(versionString, '.', 3);
  const myVersionString = i === -1 ? versionString : versionString.substring(0, i);
  const parsed = semverUtils.parse(myVersionString);

  return parsed ? {
    major: parsed.major,
    minor: parsed.minor,
    patch: parsed.patch,
    version: parsed.version,
    originalString: versionString,
    toString: () => parsed.version
  } : null;
};