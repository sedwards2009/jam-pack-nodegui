/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import fs from 'node:fs';
import * as path from "node:path";
import copy from 'recursive-copy';
import shell from "shelljs";

import { BuildStep } from "./buildstep.js";
import { CommandList } from './commandlist.js';
import { DebianConfig } from "./config.js";
import { FetchStep } from "./fetchstep.js";
import { Logger } from "./logger.js";
import { PrepareStep } from "./preparestep.js";
import { PruneStep } from './prunestep.js';
import { checkWhichCommand, getPlatform } from "./utils.js";


export class DebianStep {
  #config: DebianConfig;
  #commandList: CommandList;
  #debianSourceDirectory = "";

  constructor(config: DebianConfig) {
    this.#config = config;
    this.#commandList = new CommandList(config.prePack);
  }

  #isSkip(): boolean {
    return this.#config.skip || getPlatform() !== "linux";
  }

  async preflightCheck(logger: Logger): Promise<boolean> {
    if (this.#isSkip()) {
      logger.subsection("Debian step (skipping)");
      return true;
    }
    logger.subsection("Debian step");

    if (! await checkWhichCommand("dpkg-deb", logger)) {
      return false;
    }

    if ( ! await this.#commandList.preflightCheck(logger, "prePack")) {
      return false
    }

    return true;
  }

  async execute(logger: Logger, prepareStep: PrepareStep, fetchStep: FetchStep, buildStep: BuildStep, pruneStep: PruneStep): Promise<boolean> {
    if (this.#isSkip()) {
      logger.subsection("Debian step (skipping)");
      return true;
    }
    logger.subsection("Debian step");

    const DEBIAN_SOURCE_NAME = "debian_source";
    const debianSourcePath = path.join(prepareStep.getTempDirectory(),
      DEBIAN_SOURCE_NAME);

    logger.info("Copying source to debian directory.");

    try {
      await copy(fetchStep.getSourcePath(), path.join(debianSourcePath, "opt/" + buildStep.getApplicationName()), {
        dot: true,
	      junk: true,
      });
    } catch (error) {
      logger.error('Copy failed: ' + error);
      return false;
    }

    const debianDir = path.join(debianSourcePath, "DEBIAN");
    shell.mkdir("-p", debianDir);

    fs.writeFileSync(path.join(debianDir, "control"), this.#getControlFile(buildStep), {encoding: "utf-8"});
    fs.writeFileSync(path.join(debianDir, "conffiles"), "", {encoding: "utf-8"});

    this.#debianSourceDirectory = path.join(prepareStep.getTempDirectory(), DEBIAN_SOURCE_NAME);

    const env: { [key: string]: string } = {};
    prepareStep.addVariables(env);
    fetchStep.addVariables(env);
    buildStep.addVariables(env);
    pruneStep.addVariables(env);
    this.addVariables(env);
    if ( ! await this.#commandList.execute(logger, env)) {
      return false;
    }

    shell.cd(prepareStep.getTempDirectory());
    const command = `dpkg-deb --root-owner-group --build ${DEBIAN_SOURCE_NAME}`;
    const result = shell.exec(command);
    if (result.code !== 0) {
      logger.error(`Something went wrong while running command '${command}'`);
      return false;
    }

    const debBaseName = `${buildStep.getApplicationName()}_${buildStep.getApplicationVersion()}_amd64.deb`;
    shell.mv(`${DEBIAN_SOURCE_NAME}.deb`, debBaseName);

    logger.info(`Created debian package: ${debBaseName}`);

    return true;
  }

  #getControlFile(buildStep: BuildStep): string {
    const fields = this.#config.controlFields == null ? {} : {...this.#config.controlFields};

    const update = (name: string, value: string) => {
      if (fields[name] === undefined) {
        fields[name] = value;
      }
    };
    update("Package", buildStep.getApplicationName());
    update("Version", buildStep.getApplicationVersion());
    update("Architecture", "amd64");

    const result: string[] = [];
    for (const key of Object.getOwnPropertyNames(fields)) {
      result.push(`${key}: ${fields[key]}`);
    }
    return result.join("\n") + "\n";
  }

  getDebianSourceDirectory(): string {
    return this.#debianSourceDirectory;
  }

  addVariables(variables: {[key: string]: string}): void {
    variables["debianStep_debianSourceDirectory"] = this.getDebianSourceDirectory();
  }
}