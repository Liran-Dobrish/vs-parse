import * as fs from 'fs-extra'
import isBuffer from 'is-buffer'
import * as os from 'os'
import * as path from 'path'
import * as upath from 'upath'
import { StringDecoder } from 'string_decoder'

export class ParseOptions {
  deepParse: boolean = false
  encoding?: BufferEncoding = 'utf-8'
  dirRoot?: string | undefined = undefined
}

export function fileExistsSync(filePath: string): boolean {
  return fs.pathExistsSync(filePath);
}

export function fileExists(filePath: string): Promise<boolean> {
  return fs.pathExists(filePath);
}

export function getFileDirectory(filePath: string, options: ParseOptions): string {
  let dir: string | undefined = (isVsFileContents(filePath) || isBuffer(filePath))
    ? options.dirRoot
    : path.dirname(filePath);

  if (!dir) {
    throw new Error('Could not determine root directory. Please specify \'dirRoot\' if doing a deep parse');
  }

  return dir;
}

export function normalizePath(pathStr: string): string {
  return os.platform() == 'win32' ? pathStr : upath.normalize(pathStr);
}

function isVsFileContents(file: string): boolean {
  // Naive way to determine if string is a path or vs proj/sln file
  return (typeof file === 'string' && /\r|\n/.test(file));
};

export function getFileContentsOrFail(file: string, options: ParseOptions | undefined = undefined): Promise<string> {
  return new Promise((resolve, reject) => {
    if (isVsFileContents(file)) {
      resolve(file);
      return;
    }

    const myOptions = (options && Object.assign({}, options, { encoding: 'utf-8' })) || { encoding: 'utf-8' };

    if (isBuffer(file)) {
      const decoder = new StringDecoder(myOptions.encoding);
      const result = decoder.write(file);
      resolve(result);
      return;
    }

    return fs.readFile(file, myOptions).then(
      result => resolve(result),
      err => {
        if (err.code === 'ENOENT')
          reject(new Error('File not found: ' + file));
        else
          reject(err);
      }
    );
  });
}

export function getFileContentsOrFailSync(file: string, options: ParseOptions | undefined = undefined): string {
  if (isVsFileContents(file)) {
    return file;
  }

  let myOptions: ParseOptions = new ParseOptions();
  if (options !== undefined) {
    myOptions = Object.assign({}, options, myOptions);
  }

  if (isBuffer(file)) {
    const decoder = new StringDecoder(myOptions.encoding);
    return decoder.write(file);
  }

  try {
    return fs.readFileSync(file, myOptions).toString();
  } catch (e) {
    if (typeof file === 'string' && !fileExistsSync(file)) {
      throw new Error('File not found: ' + file);
    } else {
      throw e;
    }
  }
}
