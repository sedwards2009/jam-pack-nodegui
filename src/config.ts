/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export type Platform = 'macos' | 'linux' | 'windows';

export interface Command {
  platform?: string | string[];
  commands: string[];
}

export type CommandLine = string;

export type Commands = (Command | CommandLine)[];

export interface PrepareConfig {
  tempDirectory?: string;
}

export interface FetchConfig {
  gitUrl?: string;
  gitBranch?: string;
  gitFromCwd?: boolean;
  postFetch?: Commands;
}

export interface BuildConfig {
  skip?: boolean;
  packageManager?: string;
  scriptName?: string;
  postBuild?: Commands;
  applicationName?: string;
  applicationVersion?: string;
}

export interface PruneConfig {
  skip?: boolean;
  patterns?: FilePattern[];
  postPrune?: Commands;
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
  extraInstallCommands?: string[];
  extraUninstallCommands?: string[];
  detailColors?: string;
  appTitle?: string;
  installerIcon?: string;
  uninstallerIcon?: string;
  pathInstaller?: string;
  shortcutIcon?: string;
}

export interface DMGConfig {
  skip?: boolean;
  prePack?: Commands;
  applicationIcon?: string;
  applicationTitle?: string;
  cfBundleDisplayName?: string;
  cfBundleDevelopmentRegion?: string;
  cfBundleExecutable?: string;
  cfBundleIdentifier?: string;
  cfBundleName?: string;
  cfBundleShortVersionString?: string;
  cfBundleVersion?: string;
  nsHumanReadableCopyright?: string;
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
