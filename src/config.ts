/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export type Platform = 'macos' | 'linux' | 'windows';

export interface Command {
  platform?: string | string[];
  command: string;
}

export type CommandLine = string;

export type Commands = (Command | CommandLine)[];

export interface PrepareConfig {
  tempDirectory?: string;
}

export interface FetchConfig {
  gitUrl?: string;
  gitBranch?: string;
  postFetch?: Commands; // TODO
}

export interface BuildConfig {
  skip?: boolean;
  packageManager?: string;
  scriptName?: string;
  postBuild?: Commands;
}

export interface PruneConfig {
  patterns?: FilePattern[];
  postPrune?: Commands;  // TODO
}

export interface FilePattern {
  keep?: string[];
  delete?: string[];
  platform?: string | string[];
}

export interface QuietQodeConfig {
  skip?: boolean;
}

export interface AddLauncherConfig {
  skip?: boolean;
  jsEntryPoint: string;
  windowsVersionString?: string;
  windowsFileVersion?: string;
  windowsIcon?: string;
  windowsProductVersion?: string;

  windowsComments?: string;
  windowsCompanyName?: string;
  windowsFileDescription?: string;
  windowsInternalFilename?: string;
  windowsLegalCopyright?: string;
  windowsLegalTrademarks1?: string;
  windowsLegalTrademarks2?: string;
  windowsOriginalFilename?: string;
  windowsProductName?: string;
}

export interface ZipConfig {
  skip?: boolean;
  platforms?: string[];
  prePack?: Commands;
}

export interface DebianConfig {
  skip?: boolean;
  controlFields?: {[key: string]: string};
  prePack?: Commands;
}

export interface AppImageConfig {
  skip?: boolean;
  prePack?: Commands;
  exeEntryPoint?: string;
}

export interface NSISConfig {
  skip?: boolean;
  prePack?: Commands;
  companyName?: string;
  description?: string;
  detailColors?: string;
  appTitle?: string;
}

export interface DMGConfig {
  skip?: boolean;
  prePack?: Commands;

}

export interface Config {
  prepare: PrepareConfig;
  fetch: FetchConfig;
  build: BuildConfig;
  prune: PruneConfig;
  quietQode?: QuietQodeConfig;
  addLauncher?: AddLauncherConfig;
  zip?: ZipConfig;
  debian?: DebianConfig;
  nsis?: NSISConfig;
  appImage?: AppImageConfig;
  dmg?: DMGConfig;
}
