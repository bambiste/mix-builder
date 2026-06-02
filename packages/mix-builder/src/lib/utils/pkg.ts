import path from 'path';
import fs from 'fs';

export const pick = (object: any, keys: string[]) => {
  if (keys.length === 0) return object;
  const obj = structuredClone(object);
  const object_keys = Object.keys(obj);
  const result: any = {};
  for (const key of keys) {
    if (object_keys.some((k) => k.toString() === key.toString())) {
      result[key] = obj[key];
    }
    // delete obj[key]
  }
  return result;
  // return keys.reduce((acc, key) => {
  //     acc[key] = object[key]
  //     return acc
  // }, {})
};
export function copyPkgJson(pkgDir: string, DIST_DIR = 'dist') {
  const pkgJsonPath = path.join(pkgDir, DIST_DIR, 'package.json');
  let pkgJson = JSON.parse(
    fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf-8')
  );
  if (!pkgJson.exports) pkgJson.exports = {};
  const extra_keys = ['main', 'type', 'module'];
  const extra = pick(pkgJson, extra_keys);
  const replace_dist = (obj: any) => {
    const result = {};
    Object.keys(obj).forEach((o) => {
      let key = o;
      let value = { ...obj }[o];
      key = o.replace(DIST_DIR + '/', '');
      // console.log({key, value})
      // if(key.includes('dist')){
      // }
      if (typeof value === 'object') {
        value = replace_dist(value);
      } else {
        value = value.replace(DIST_DIR + '/', '');
        if (value.includes('dist')) {
          console.log({ key, value });
        }
      }
      (result as any)[key] = value;
    });
    return result;
  };
  pkgJson.exports = replace_dist(pkgJson.exports);
  if (Object.keys(extra).length > 0) {
    pkgJson = { ...pkgJson, ...replace_dist(extra) };
  }
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));
}
