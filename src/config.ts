/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface PrepareConfig {
  tempDirectory?: string;
}

export interface FetchConfig {
  gitUrl?: string;
  gitBranch?: string;
  commands?: string[];
}

export interface BuildConfig {
  packageManager?: string;
  scriptName?: string;
  commands?: string[];
}

export interface PruneConfig {
  patterns?: FilePattern[];
}

export interface FilePattern {
  keep?: string[];
  delete?: string[];
  platform?: string;
}

export type Platform = 'macos' | 'linux' | 'windows';

export interface ZipConfig {
  platforms?: string[];
}

export interface Config {
  prepare: PrepareConfig;
  fetch: FetchConfig;
  build: BuildConfig;
  prune: PruneConfig;
  zip?: ZipConfig;
}
