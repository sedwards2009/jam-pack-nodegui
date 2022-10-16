/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import fs from 'node:fs';
import * as path from "node:path";
import copy from 'recursive-copy';
import shell from "shelljs";

import { AddLauncherStep } from './addlauncherstep.js';
import { BuildStep } from "./buildstep.js";
import { CommandList } from './commandlist.js';
import { DMGConfig } from "./config.js";
import { FetchStep } from "./fetchstep.js";
import { Logger } from "./logger.js";
import { PrepareStep } from "./preparestep.js";
import { PruneStep } from './prunestep.js';
import { executeCommandAndCaptureOutput, getPlatform } from "./utils.js";


export class DmgStep {
  #config: DMGConfig;
  #commandList: CommandList;
  #dmgSourceDirectory = "";
  #dmgResourcesDirectory = "";
  #dmgMacOSDirectory = "";

  constructor(config: DMGConfig) {
    this.#config = config;
    this.#commandList = new CommandList(config.prePack);
  }

  #isSkip(): boolean {
    return this.#config.skip || getPlatform() !== "macos";
  }

  async preflightCheck(logger: Logger): Promise<boolean> {
    if (this.#isSkip()) {
      logger.subsection("DMG step (skipping)");
      return true;
    }
    logger.subsection("DMG step");

    if ( ! await this.#commandList.preflightCheck(logger, "prePack")) {
      return false
    }

    return true;
  }

  async execute(logger: Logger, prepareStep: PrepareStep, fetchStep: FetchStep, buildStep: BuildStep,
      pruneStep: PruneStep, addLauncherStep: AddLauncherStep): Promise<boolean> {

    if (this.#isSkip()) {
      logger.subsection("DMG step (skipping)");
      return true;
    }
    logger.subsection("DMG step");

    const DMG_SOURCE_NAME = "dmg_source";
    this.#dmgSourceDirectory = path.join(prepareStep.getTempDirectory(), DMG_SOURCE_NAME);

    logger.info("Copying source to DMG directory.");

    shell.mkdir(this.#dmgSourceDirectory);
    const appTitle = this.#config.applicationTitle ?? buildStep.getApplicationName();
    const appVersion = buildStep.getApplicationVersion();

    shell.mkdir(path.join(this.#dmgSourceDirectory, `${appTitle}.app`));

    const contentsPath = path.join(this.#dmgSourceDirectory, `${appTitle}.app`, `Contents`);
    shell.mkdir(contentsPath);
    this.#dmgResourcesDirectory = path.join(contentsPath, "Resources");
    shell.mkdir(this.#dmgResourcesDirectory);
    this.#dmgMacOSDirectory = path.join(contentsPath, "MacOS");
    shell.mkdir(this.#dmgMacOSDirectory);

    try {
      await copy(fetchStep.getSourcePath(), this.#dmgResourcesDirectory, {
        dot: true,
	      junk: true,
      });
    } catch (error) {
      logger.error('Copy failed: ' + error);
      return false;
    }

    if (addLauncherStep != null && ! addLauncherStep.isSkip()) {
      const launcherPath = path.join(this.#dmgResourcesDirectory, addLauncherStep.getLauncherName());
      const newLauncherPath = path.join(contentsPath, "MacOS", addLauncherStep.getLauncherName());
      shell.mv(launcherPath, newLauncherPath);
    }

    let appIcon = path.join(__dirname, "../resources/macos/jam-app.icns");
    if (this.#config.applicationIcon != null) {
      const result = await this.#expandUserPath(this.#config.applicationIcon, logger, prepareStep, fetchStep, buildStep, pruneStep);
      if ( ! result.success) {
        return false;
      }
      appIcon = result.path;
    }
    const appIconFilename = path.basename(appIcon);
    shell.cp(appIcon, path.join(this.#dmgResourcesDirectory, appIconFilename));

    const plistContents = this.#getPlistFile(buildStep, appIconFilename);
    fs.writeFileSync(path.join(contentsPath, "Info.plist"), plistContents, {encoding: 'utf8'});

    const volumeIconPath = appIcon;
    const backgroundPath = path.join(__dirname, "../resources/macos/dmg_background.png");
    const appdmgConfig = {
      "title": appTitle,
      "icon": volumeIconPath,
      "background": backgroundPath,
      "contents": [
        { "x": 448, "y": 230, "type": "link", "path": "/Applications" },
        { "x": 192, "y": 230, "type": "file", "path": `dmg_source/${appTitle}.app` }
      ]
    };
    fs.writeFileSync(path.join(prepareStep.getTempDirectory(), "appdmg.json"), JSON.stringify(appdmgConfig),
      {encoding: "utf-8"});

    const env = this.#getCommandEnvVariables(prepareStep, fetchStep, buildStep, pruneStep);
    if ( ! await this.#commandList.execute(logger, env)) {
      return false;
    }

    shell.cd(prepareStep.getTempDirectory());
    try {
      await this.#runAppdmg("appdmg.json", `${appTitle}_${appVersion}.dmg`);
    } catch(err) {
      logger.error(`Something went wrong while running command appdmg. ${err}`);
      return false;
    }

    logger.info(`Created DMG file`);

    return true;
  }

  #getPlistFile(buildStep: BuildStep, cfBundleIconFile: string): string {
    const appTitle = this.#config.applicationTitle ?? buildStep.getApplicationName();
    const appVersion = buildStep.getApplicationVersion();

    const cfBundleDisplayName = this.#config.cfBundleDisplayName ?? appTitle;
    const cfBundleDevelopmentRegion = this.#config.cfBundleDevelopmentRegion ?? "en";
    const cfBundleExecutable = this.#config.cfBundleExecutable ?? appTitle;
    const cfBundleIdentifier = this.#config.cfBundleIdentifier ?? appTitle;
    const cfBundleName = this.#config.cfBundleName ?? appTitle;
    const cfBundleShortVersionString = this.#config.cfBundleShortVersionString ?? appVersion;
    const cfBundleVersion = this.#config.cfBundleVersion ?? appVersion;
    const nsHumanReadableCopyright = this.#config.nsHumanReadableCopyright ?? "";

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
    <dict>
        <key>CFBundleDisplayName</key>
        <string>${xmlEncode(cfBundleDisplayName)}</string>
        <key>CFBundleDevelopmentRegion</key>
        <string>${xmlEncode(cfBundleDevelopmentRegion)}</string>
        <key>CFBundleExecutable</key>
        <string>${xmlEncode(cfBundleExecutable)}</string>
        <key>CFBundleIdentifier</key>
        <string>${xmlEncode(cfBundleIdentifier)}</string>
        <key>CFBundleIconFile</key>
        <string>${cfBundleIconFile}</string>
        <key>CFBundleInfoDictionaryVersion</key>
        <string>6.0</string>
        <key>CFBundleName</key>
        <string>${xmlEncode(cfBundleName)}</string>
        <key>CFBundlePackageType</key>
        <string>APPL</string>
        <key>CFBundleShortVersionString</key>
        <string>${xmlEncode(cfBundleShortVersionString)}</string>
        <key>CFBundleVersion</key>
        <string>${xmlEncode(cfBundleVersion)}</string>
        <key>CFBundleSupportedPlatforms</key>
        <array>
        <string>MacOSX</string>
        </array>
        <key>LSMinimumSystemVersion</key>
        <string>10.15</string>
        <key>NSHumanReadableCopyright</key>
        <string>${xmlEncode(nsHumanReadableCopyright)}</string>
        <key>NSHighResolutionCapable</key>
        <string>True</string>
    </dict>
</plist>
`;
  }
  async #runAppdmg(sourceJson: string, destination: string): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      const appdmg = require("appdmg"); // Only availabeon Windows
      const ee = appdmg({ source: sourceJson, target: destination });
      ee.on('finish', function () {
        resolve();
      });

      ee.on('error', function (err) {
        reject(err);
      });
    });
  }

  #getCommandEnvVariables(prepareStep: PrepareStep, fetchStep: FetchStep, buildStep: BuildStep, pruneStep: PruneStep): { [key: string]: string } {
    const env: { [key: string]: string } = {};
    prepareStep.addVariables(env);
    fetchStep.addVariables(env);
    buildStep.addVariables(env);
    pruneStep.addVariables(env);
    this.addVariables(env);
    return env;
  }

  async #expandUserPath(userPath: string, logger: Logger, prepareStep: PrepareStep, fetchStep: FetchStep, buildStep: BuildStep,
    pruneStep: PruneStep): Promise<{path: string, success: boolean}> {

  const env = this.#getCommandEnvVariables(prepareStep, fetchStep, buildStep, pruneStep);
  const commandLine = `echo ${userPath}`;
  const {result, output} = await executeCommandAndCaptureOutput(commandLine, env);
  if (result !== 0) {
    logger.error(`Error occurred while running '${commandLine}'.`);
    return { path: null, success: false};
  }
  return { path: output.split("\n")[0], success: true};
}

  getDMGSourceDirectory(): string {
    return this.#dmgSourceDirectory;
  }

  getDMGResourcesDirectory(): string {
    return this.#dmgResourcesDirectory;
  }

  getDMGMacOSDirectory(): string {
    return this.#dmgMacOSDirectory;
  }

  addVariables(variables: {[key: string]: string}): void {
    variables["dmgStep_dmgSourceDirectory"] = this.getDMGSourceDirectory();
    variables["dmgStep_dmgMacOSDirectory"] = this.getDMGMacOSDirectory();
    variables["dmgStep_dmgResourcesDirectory"] = this.getDMGResourcesDirectory();
  }
}

function xmlEncode(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
