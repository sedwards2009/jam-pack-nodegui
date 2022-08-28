/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import shell from "shelljs";
import { PruneConfig } from "./config.js";
import { FetchStep } from "./fetchstep.js";
import { FileTreeFilter } from "./filetreefilter.js";
import { Logger } from "./logger.js";
import { getPlatform, isValidPlatform, pruneEmptyDirectories } from "./utils.js";


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
        if (! isValidPlatform(pattern.platform)) {
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

    shell.cd(fetchStep.getSourcePath());

    const filterResultCallback = (path: string, accept: boolean): void => {
      if (accept) {
        logger.keep(`Keeping '${path}'`);
      } else {
        logger.prune(`Pruning '${path}'`);
        shell.rm('-f', path);
      }
    };

    const treeFilter = new FileTreeFilter(filterResultCallback);

    const platform = getPlatform();
    for (const pattern of this.#config.patterns) {
      const patternPlatform = pattern.platform ?? platform;
      if (patternPlatform === platform) {
        const keepList = pattern.keep ?? [];
        const deleteList = pattern.delete ?? [];
        treeFilter.addPattern(keepList, deleteList)
      }
    }

    const nodeguiAcceptList = [
      "node_modules/@nodegui/qode/binaries/*",
      "node_modules/@nodegui/qode/package.json",
      "node_modules/@nodegui/nodegui/package.json",
      "node_modules/@nodegui/nodegui/dist/**/*.js",

      "node_modules/postcss/**/*",

      "node_modules/picocolors/picocolors.js",
      "node_modules/picocolors/README.md",
      "node_modules/picocolors/LICENSE",
      "node_modules/picocolors/package.json",

      "node_modules/source-map/**/*",

      "node_modules/postcss-nodegui-autoprefixer/**/*",

      "node_modules/cuid/index.js",
      "node_modules/cuid/lib/*.js",
      "node_modules/cuid/LICENSE",
      "node_modules/cuid/package.json",

      "node_modules/memoize-one/README.md",
      "node_modules/memoize-one/LICENSE",
      "node_modules/memoize-one/package.json",
      "node_modules/memoize-one/dist/memoize-one.cjs.js",
    ];

    if (platform === "linux") {
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/build/Release/nodegui_core.node");

      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt5Core.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt5DBus.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt5EglFSDeviceIntegration.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt5EglFsKmsSupport.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt5Gui.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt5Network.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt5PrintSupport.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt5Sql.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt5Svg.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt5Widgets.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt5XcbQpa.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libicudata.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libicui18n.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libicule.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libicutu.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libicuuc.so*");

      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libqconnmanbearer.so");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libqgenericbearer.so");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libqnmbearer.so");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libqsvgicon.so");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libqgif.so");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libqico.so");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libqjpeg.so");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libqsvg.so");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libcomposeplatforminputcontextplugin.so");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libibusplatforminputcontextplugin.so");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libqxcb.so");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libcupsprintersupport.so");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libqxcb-egl-integration.so");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libqxcb-glx-integration.so");
    }

    const nodeguiDeleteList = [
      "node_modules/@nodegui/nodegui/dist/demo.js",
      "node_modules/@nodegui/nodegui/dist/demo.d.ts",
      "node_modules/@nodegui/nodegui/dist/examples/**/*",

      "node_modules/postcss-nodegui-autoprefixer/CHANGELOG.md",
      "node_modules/postcss-nodegui-autoprefixer/dist/index.d.ts",
      "node_modules/postcss-nodegui-autoprefixer/dist/__tests__/*",
    ];

    treeFilter.addPattern(nodeguiAcceptList, nodeguiDeleteList);

    treeFilter.run(".");

    logger.info("Pruning empty directories");
    await pruneEmptyDirectories(".");

    return true;
  }
}
