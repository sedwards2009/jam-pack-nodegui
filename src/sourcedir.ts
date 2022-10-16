/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as nodePath from "path";

declare const __dirname: string;  // Common JS

export const path = __dirname;

let posixSourcePath = path;
if (process.platform === "win32") {
  posixSourcePath = nodePath.posix.join(...path.split(nodePath.sep));
}
// Like `path` but with forward slashes instead of backwards.
export const posixPath = posixSourcePath;
