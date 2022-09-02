/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import path from "node:path";
import shell from "shelljs";
import { BuildStep } from "./buildstep.js";
import { ZipConfig } from "./config.js";
import { FetchStep } from "./fetchstep.js";
import { Logger } from "./logger.js";
import { PrepareStep } from "./preparestep.js";
import { checkWhichCommand, getPlatform, isValidPlatform } from "./utils.js";


export class ZipStep {
  #config: ZipConfig;
  #archiveBaseName: string = null;
  #zipName: string = null;
  #zipPath: string = null;

  constructor(config: ZipConfig) {
    this.#config = config;
  }

  async preflightCheck(logger: Logger): Promise<boolean> {
    if (this.#config.platforms != null) {
      for (const platform of this.#config.platforms) {
        if (! isValidPlatform(platform)) {
          logger.subsection("Zip step");
          logger.checkError(`Invalid platform name '${platform}' was found in the config 'zip' section.`);
          return false;
        }
      }
    }

    if ( ! this.#isEnabled()) {
      logger.subsection("Zip step (skipping, not enabled for this platform)");
      return true;
    }

    logger.subsection("Zip step");

    if (! await checkWhichCommand("zip", logger)) {
      return false;
    }

    return true;
  }

  #isEnabled(): boolean {
    if (this.#config.platforms == null) {
      return false;
    }
    return this.#config.platforms.includes(getPlatform());
  }

  async execute(logger: Logger, prepareStep: PrepareStep, fetchStep: FetchStep, buildStep: BuildStep): Promise<boolean> {
    if ( ! this.#isEnabled()) {
      logger.subsection("Zip step (skipping, not enabled for this platform)");
      return true;
    }

    logger.subsection("Zip step");
    this.#setupZipName(prepareStep, buildStep);
    fetchStep.moveSourceDirectory(this.#archiveBaseName);

    shell.cd(fetchStep.getSourcePath());
    shell.cd("..");

    logger.checkOk(`Output zip name: ${this.#zipName}`);

    const linkOption = process.platform === "win32" ? "" : "-y";
    const command = `zip ${linkOption} -r "${this.#zipPath}" "${fetchStep.getSourceDirectoryName()}"`;
    const result = shell.exec(command);
    if (result.code !== 0) {
      logger.error(`Something went wrong while running command '${command}'`);
      return false;
    }
    logger.info(`Created zip file: ${this.#zipName}`);
    return true;
  }

  #setupArchiveBaseName(buildStep: BuildStep): void {
    this.#archiveBaseName = `${buildStep.getApplicationName()}-${buildStep.getApplicationVersion()}-${getPlatform()}-x64`;
  }

  #setupZipName(prepareStep: PrepareStep, buildStep: BuildStep): void {
    this.#setupArchiveBaseName(buildStep);
    this.#zipName = `${this.#archiveBaseName}.zip`;
    this.#zipPath = path.posix.join(prepareStep.getTempDirectory(), this.#zipName);
  }
}
