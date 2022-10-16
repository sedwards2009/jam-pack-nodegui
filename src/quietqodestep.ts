/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as shell from "shelljs";

import { QuietQodeConfig } from "./config.js";
import { FetchStep } from "./fetchstep.js";
import { Logger } from "./logger.js";
import { getPlatform } from "./utils.js";
import { switchToGuiSubsystem } from "./patchwindowsexe.js";


export class QuietQodeStep {
  #config: QuietQodeConfig = null;

  constructor(config: QuietQodeConfig) {
    this.#config = config;
  }

  #isSkip(): boolean {
    return this.#config.skip || getPlatform() !== "windows";
  }

  async preflightCheck(logger: Logger): Promise<boolean> {
    if (this.#isSkip()) {
      logger.subsection("Quiet Qode step (skipping)");
      return true;
    }
    logger.subsection("Quiet Qode step");
    return true;
  }

  async execute(logger: Logger, fetchStep: FetchStep): Promise<boolean> {
    if (this.#isSkip()) {
      logger.subsection("Quiet Qode step (skipping)");
      return true;
    }
    logger.subsection("Quiet Qode step");

    shell.cd(fetchStep.getSourcePath());
    for (const item of shell.ls("node_modules/@nodegui/qode/binaries/*.exe")) {
      switchToGuiSubsystem(item);
    }
    logger.info(`Stopped qode from opening a console window when run.`);
    return true;
  }
}
