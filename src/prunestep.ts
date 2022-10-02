/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import path from "node:path";
import shell from "shelljs";
import { PruneConfig } from "./config.js";
import { FetchStep } from "./fetchstep.js";
import { FileTreeFilter } from "./filetreefilter.js";
import { Logger } from "./logger.js";
import { PrepareStep } from "./preparestep.js";
import { getPlatform, isValidPlatform, pruneEmptyDirectories } from "./utils.js";


const TRASH_DIR_NAME = "trash";


export class PruneStep {
  #config: PruneConfig;
  #trashPath: string;

  constructor(config: PruneConfig) {
    this.#config = config;
  }

  #isSkip(): boolean {
    return this.#config.skip;
  }

  async preflightCheck(logger: Logger, prepareStep: PrepareStep): Promise<boolean> {
    if (this.#isSkip()) {
      logger.subsection("Prune step (skipping)");
      return true;
    }
    logger.subsection("Prune step");

    this.#trashPath = path.join(prepareStep.getTempDirectory(), TRASH_DIR_NAME);

    if (this.#config.patterns == null) {
      logger.checkError(`The 'prune' section in the config file doesn't contain a 'patterns' field.`);
      return false;
    }

    for (const pattern of this.#config.patterns) {
      if (pattern.platform != null) {
        let platforms = pattern.platform;
        if ( ! Array.isArray(platforms)) {
          platforms = [platforms];
        }
        pattern.platform = platforms.map(p => p.toLowerCase());
        for (const platform of platforms) {
          if (! isValidPlatform(platform)) {
            logger.checkError(`A pattern has an invalid platform value '${platform}'. Valid options are 'macos', 'linux', or 'windows'.`);
            return false;
          }
        }
      }
    }

    logger.checkOk(`Using directory '${this.getTrashPath()}' to hold pruned files.`);

    return true;
  }

  async execute(logger: Logger, fetchStep: FetchStep): Promise<boolean> {
    if (this.#isSkip()) {
      logger.subsection("Prune step (skipping)");
      return true;
    }
    logger.subsection("Prune step");

    logger.info("Pruning files");

    shell.cd(fetchStep.getSourcePath());

    const filterResultCallback = (resultPath: string, accept: boolean): void => {
      if (accept) {
        logger.keep(`Keeping '${resultPath}'`);
      } else {
        logger.prune(`Pruning '${resultPath}'`);
        const targetPath = path.join(this.#trashPath, resultPath);
        shell.mkdir("-p", path.dirname(targetPath));
        shell.mv(resultPath, targetPath);
      }
    };

    const treeFilter = new FileTreeFilter(filterResultCallback);

    const platform = getPlatform();
    for (const pattern of this.#config.patterns) {
      let patternPlatform = pattern.platform ?? platform;
      if ( ! Array.isArray(patternPlatform)) {
        patternPlatform = [patternPlatform];
      }
      if (patternPlatform.includes(platform)) {
        const keepList = pattern.keep ?? [];
        const deleteList = pattern.delete ?? [];
        treeFilter.addPattern(keepList, deleteList)
      }
    }

    const nodeguiAcceptList = [
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

    const nodeguiDeleteList = [
      "node_modules/@nodegui/nodegui/dist/demo.js",
      "node_modules/@nodegui/nodegui/dist/demo.d.ts",
      "node_modules/@nodegui/nodegui/dist/examples/**/*",

      "node_modules/postcss-nodegui-autoprefixer/CHANGELOG.md",
      "node_modules/postcss-nodegui-autoprefixer/dist/index.d.ts",
      "node_modules/postcss-nodegui-autoprefixer/dist/__tests__/*",
    ];

    if (platform === "linux") {
      nodeguiAcceptList.push("node_modules/@nodegui/qode/binaries/*");
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

    if (platform === "windows") {
      nodeguiAcceptList.push("node_modules/@nodegui/qode/binaries/*.exe");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/build/Release/nodegui_core.node");

      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/D3Dcompiler_47.dll");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libEGL.dll");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libGLESv2.dll");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/Qt5Core.dll");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/Qt5Gui.dll");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/Qt5Svg.dll");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/Qt5Widgets.dll");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/qsvgicon.dll");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/qwindows.dll");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/qwindowsvistastyle.dll");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/qgif.dll");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/qico.dll");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/qjpeg.dll");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/qsvg.dll");
    }

    if (platform === "macos") {
      nodeguiAcceptList.push("node_modules/@nodegui/qode/binaries/*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/build/Release/nodegui_core.node");

      for (const lib of ["QtConcurrent", "QtCore", "QtDBus", "QtGui", "QtPrintSupport", "QtSvg", "QtWidgets"]) {
        nodeguiAcceptList.push(`node_modules/@nodegui/nodegui/miniqt/**/${lib}.framework/**/*`);

        nodeguiDeleteList.push(`node_modules/@nodegui/nodegui/miniqt/**/${lib}.framework/Headers`);
        nodeguiDeleteList.push(`node_modules/@nodegui/nodegui/miniqt/**/${lib}.framework/**/Headers/**/*`);
      }
      
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/plugins/iconengines/libqsvgicon.dylib");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/plugins/imageformats/*.dylib");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/plugins/platforms/*.dylib");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/plugins/platformthemes/libqxdgdesktopportal.dylib");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/plugins/printsupport/libcocoaprintersupport.dylib");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/plugins/styles/libqmacstyle.dylib");
    }

    treeFilter.addPattern(nodeguiAcceptList, nodeguiDeleteList);

    treeFilter.run(".");

    logger.info("Pruning empty directories");
    await pruneEmptyDirectories(".");

    return true;
  }

  getTrashPath(): string {
    return this.#trashPath;
  }

  addVariables(variables: {[key: string]: string}): void {
    variables["pruneStep_trashPath"] = this.getTrashPath();
  }
}
