/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import fs from "node:fs";
import path from "node:path";
import shell from "shelljs";
import {fileURLToPath} from 'node:url';
import { BuildStep } from "./buildstep.js";

import { AddLauncherConfig } from "./config.js";
import { FetchStep } from "./fetchstep.js";
import { Logger } from "./logger.js";
import { getPlatform } from "./utils.js";
import { switchToGuiSubsystem } from "./patchwindowsexe.js";
import rcedit, { Options as RceditOptions, VersionStringOptions as RceditVersionStringOptions } from 'rcedit';
import { path as __dirname } from "./sourcedir.js";


export class AddLauncherStep {
  #config: AddLauncherConfig = null;
  #launcherName: string = null;

  constructor(config: AddLauncherConfig) {
    this.#config = config;
  }

  async preflightCheck(logger: Logger): Promise<boolean> {
    if (this.#config.skip) {
      logger.subsection("Add Launcher step (skipping)");
      return true;
    }
    logger.subsection("Add Launcher step");
    logger.checkOk("Using default application name as launcher executable name.");

    if (this.#config.jsEntryPoint == null) {
      logger.checkError(`No 'jsEntryPoint' field was found in the configuration file, 'addLauncher' section.`);
      return false;
    }
    logger.checkOk(`Using '${this.#config.jsEntryPoint}' as the JavaScript entry point.`);

    return true;
  }

  async execute(logger: Logger, fetchStep: FetchStep, buildStep: BuildStep): Promise<boolean> {
    if (this.#config.skip) {
      logger.subsection("Add Launcher step (skipping)");
      return true;
    }
    logger.subsection("Add Launcher step");
    const jsEntryPoint = this.#config.jsEntryPoint;

    if ( ! shell.test("-f", path.join(fetchStep.getSourcePath(), jsEntryPoint))) {
      logger.error(`JavaScript entry point file '${jsEntryPoint}' can't be found.`);
      return false;
    }

    const platform = getPlatform();
    const extension = platform === "windows" ? ".exe" : "";
    this.#launcherName = buildStep.getApplicationName() + extension;
    const destPath = path.join(fetchStep.getSourcePath(), this.#launcherName);

    if (shell.test("-e", destPath)) {
      logger.error(`Unable to copy in the launcher executable to '${destPath}', a file with the same name already exists.`);
      return false;
    }

    const launcherName = {
      "linux": "linux_launcher",
      "macos": "macos_launcher",
      "windows": "windows_launcher.exe",
    }[platform];

    const launcherExe = fs.readFileSync(path.join(__dirname, "../resources/launcher/", launcherName));

    patchBinary(launcherExe, "4f8177788c5a4086ac9f18d8639b7717", jsEntryPoint);

    if (platform === "windows") {
      const dllDirs = new Set();
      shell.cd(fetchStep.getSourcePath());
      for (const dll of shell.ls("**/*.dll")) {
        dllDirs.add(path.dirname(dll));
      }

      const dllPaths = Array.from(dllDirs).join(";") + ";\0";
      patchBinary(launcherExe, "92c9c49a891d4061ba239c46fcf4c840", dllPaths);
    }

    fs.writeFileSync(destPath, launcherExe);
    if (platform === "windows") {
      switchToGuiSubsystem(destPath);

      let iconPath = path.join(__dirname, "../resources/icons/small_logo.ico");
      const options: RceditOptions = {
        icon: iconPath
      };

      const versionOptions: RceditVersionStringOptions = {};

      if (this.#config.windowsVersionString != null) {
        options["product-version"] = this.#config.windowsVersionString;
      }
      if (this.#config.windowsFileVersion != null) {
        options["file-version"] = this.#config.windowsFileVersion;
      }
      if (this.#config.windowsComments != null) {
        versionOptions.Comments = this.#config.windowsComments;
        options["version-string"] = versionOptions;
      }
      if (this.#config.windowsCompanyName != null) {
        versionOptions.CompanyName = this.#config.windowsCompanyName;
        options["version-string"] = versionOptions;
      }
      if (this.#config.windowsFileDescription != null) {
        versionOptions.FileDescription = this.#config.windowsFileDescription;
        options["version-string"] = versionOptions;
      }
      if (this.#config.windowsInternalFilename != null) {
        versionOptions.InternalFilename = this.#config.windowsInternalFilename;
        options["version-string"] = versionOptions;
      }
      if (this.#config.windowsLegalCopyright != null) {
        versionOptions.LegalCopyright = this.#config.windowsLegalCopyright;
        options["version-string"] = versionOptions;
      }
      if (this.#config.windowsLegalTrademarks1 != null) {
        versionOptions.LegalTrademarks1 = this.#config.windowsLegalTrademarks1;
        options["version-string"] = versionOptions;
      }
      if (this.#config.windowsLegalTrademarks2 != null) {
        versionOptions.LegalTrademarks2 = this.#config.windowsLegalTrademarks2;
        options["version-string"] = versionOptions;
      }
      if (this.#config.windowsOriginalFilename != null) {
        versionOptions.OriginalFilename = this.#config.windowsOriginalFilename;
        options["version-string"] = versionOptions;
      }
      if (this.#config.windowsProductName != null) {
        versionOptions.ProductName = this.#config.windowsProductName;
        options["version-string"] = versionOptions;
      }

      await rcedit(destPath, options);
    }

    if (platform === "linux" || platform === "macos") {
      shell.chmod("a+x", destPath);
    }

    logger.info(`Wrote launcher executable '${this.#launcherName}'`);
    return true;
  }

  getLauncherName(): string {
    return this.#launcherName;
  }
}

function patchBinary(binary: Buffer, magic: string, value: string): void {
  const entryPointByteOffset = binary.indexOf(magic);
  for (let i=0; i<value.length; i++) {
    binary[entryPointByteOffset+i] = value.codePointAt(i);
  }
  binary[entryPointByteOffset+value.length] = 0;
}
