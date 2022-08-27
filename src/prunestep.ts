/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import shell from "shelljs";
import { Platform, PruneConfig } from "./config.js";
import { FetchStep } from "./fetchstep.js";
import { FileTreeFilter } from "./filetreefilter.js";
import { Logger } from "./logger.js";
import { pruneEmptyDirectories } from "./utils.js";


export class PruneStep {
  #config: PruneConfig;

  constructor(config: PruneConfig) {
    this.#config = config;
  }

  async preflightCheck(logger: Logger): Promise<boolean> {
    logger.subsection("Prune step");

    if (this.#config.patterns == null) {
      logger.checkError(`The 'prune' section in the config file doesn't contain a 'patterns' field.`);
      return false;
    }

    for (const pattern of this.#config.patterns) {
      if (pattern.platform != null) {
        pattern.platform = pattern.platform.toLowerCase();
        if (! ['macos', 'linux', 'windows'].includes(pattern.platform)) {
          logger.checkError(`A pattern has an invalid platform value '${pattern.platform}'. Valid options are 'macos', 'linux', or 'windows'.`);
          return false;
        }
      }

    }

    return true;
  }

  async execute(logger: Logger, fetchStep: FetchStep): Promise<boolean> {
    logger.subsection("Prune step");
    logger.info("Pruning files");

    shell.cd(fetchStep.getSourceDirectory());

    const filterResultCallback = (path: string, accept: boolean): void => {
      if (accept) {
        logger.keep(`Keeping '${path}'`);
      } else {
        logger.prune(`Pruning '${path}'`);
        shell.rm('-f', path);
      }
    };

    const treeFilter = new FileTreeFilter(filterResultCallback);

    const platform = this.#getPlatform();
    for (const pattern of this.#config.patterns) {
      const patternPlatform = pattern.platform ?? platform;
      if (patternPlatform === platform) {
        const keepList = pattern.keep ?? [];
        const deleteList = pattern.delete ?? [];
        treeFilter.addPattern(keepList, deleteList)
      }
    }

    treeFilter.run(".");

    logger.info("Pruning empty directories");
    await pruneEmptyDirectories(".");

    return true;
  }

  #getPlatform(): Platform {
    switch(process.platform) {
      case "win32":
        return "windows";
      case "win32":
        return "windows";
      default:
        return "linux";
    }
  }
}
