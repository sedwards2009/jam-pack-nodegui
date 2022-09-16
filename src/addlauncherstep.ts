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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class AddLauncherStep {
  #config: AddLauncherConfig = null;

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
    const destLauncherName = buildStep.getApplicationName() + extension;
    const destPath = path.join(fetchStep.getSourcePath(), destLauncherName);

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
    }

    if (platform === "linux" || platform === "macos") {
      shell.chmod("a+x", destPath);
    }

    logger.info(`Wrote launcher executable '${destLauncherName}'`);
    return true;
  }
}

function patchBinary(binary: Buffer, magic: string, value: string): void {
  const entryPointByteOffset = binary.indexOf(magic);
  for (let i=0; i<value.length; i++) {
    binary[entryPointByteOffset+i] = value.codePointAt(i);
  }
  binary[entryPointByteOffset+value.length] = 0;
}
