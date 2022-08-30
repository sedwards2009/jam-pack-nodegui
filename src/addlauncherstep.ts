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
    logger.checkOk("Will use default application name as launcher executable name.");

    return true;
  }

  async execute(logger: Logger, fetchStep: FetchStep, buildStep: BuildStep): Promise<boolean> {
    if (this.#config.skip) {
      logger.subsection("Add Launcher step (skipping)");
      return true;
    }
    logger.subsection("Add Launcher step");

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
    fs.writeFileSync(destPath, launcherExe);

    if (platform === "linux" || platform === "macos") {
      shell.chmod("a+x", destPath);
    }

    logger.info(`Wrote launcher executable '${destLauncherName}'`);
    return true;
  }
}
