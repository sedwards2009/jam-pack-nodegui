/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from "path";
import * as shell from "shelljs";
import { BuildStep } from "./buildstep.js";
import { CommandList } from './commandlist.js';
import { PruneConfig } from "./config.js";
import { FetchStep } from "./fetchstep.js";
import { FileTreeFilter } from "./filetreefilter.js";
import { Logger } from "./logger.js";
import { PrepareStep } from "./preparestep.js";
import { getPlatform, isValidPlatform, pruneEmptyDirectories, pruneSymlinks } from "./utils.js";


const TRASH_DIR_NAME = "trash";


export class PruneStep {
  #config: PruneConfig;
  #trashDirectory: string;
  #commandList: CommandList;

  constructor(config: PruneConfig) {
    this.#config = config;
    this.#commandList = new CommandList(config.postPrune);
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

    this.#trashDirectory = path.join(prepareStep.getTempDirectory(), TRASH_DIR_NAME);

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

    logger.checkOk(`Using directory '${this.getTrashDirectory()}' to hold pruned files.`);

    if ( ! await this.#commandList.preflightCheck(logger, "postPrune")) {
      return false
    }

    return true;
  }

  async execute(logger: Logger, prepareStep: PrepareStep, fetchStep: FetchStep, buildStep: BuildStep): Promise<boolean> {
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
        const targetPath = path.join(this.#trashDirectory, resultPath);
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

      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt6Core.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt6DBus.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt6EglFSDeviceIntegration.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt6EglFsKmsSupport.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt6Gui.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt6Network.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt6PrintSupport.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt6OpenGL.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt6OpenGLWidgets.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt6Sql.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt6Svg.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt6SvgWidgets.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt6Widgets.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libQt6XcbQpa.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libicudata.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libicui18n.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libicule.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libicutu.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libicuuc.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libicuio.so*");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libiculx.so*");
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
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libqgtk3.so");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libqxdgdesktopportal.so");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libqxcb-egl-integration.so");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libqxcb-glx-integration.so");
    }

    if (platform === "windows") {
      nodeguiAcceptList.push("node_modules/@nodegui/qode/binaries/*.exe");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/build/Release/nodegui_core.node");

      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/D3Dcompiler_47.dll");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libEGL.dll");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/libGLESv2.dll");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/Qt6Core.dll");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/Qt6Gui.dll");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/Qt6OpenGL.dll");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/Qt6OpenGLWidgets.dll");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/Qt6Svg.dll");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/Qt6SvgWidgets.dll");
      nodeguiAcceptList.push("node_modules/@nodegui/nodegui/miniqt/**/Qt6Widgets.dll");
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

      for (const lib of ["QtConcurrent", "QtCore", "QtDBus", "QtGui", "QtOpenGL", "QtOpenGLWidgets", "QtPrintSupport", "QtSvg", "QtSvgWidgets", "QtWidgets"]) {
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

    if (platform === "windows") {
      logger.info("Pruning symlinks");
      await pruneSymlinks(".");
    }

    logger.info("Pruning empty directories");
    await pruneEmptyDirectories(".");

    shell.cd(prepareStep.getTempDirectory());
    const env: { [key: string]: string } = {};
    prepareStep.addVariables(env);
    fetchStep.addVariables(env);
    buildStep.addVariables(env);
    this.addVariables(env);
    if ( ! await this.#commandList.execute(logger, env)) {
      return false;
    }

    return true;
  }

  getTrashDirectory(): string {
    return this.#trashDirectory;
  }

  addVariables(variables: {[key: string]: string}): void {
    variables["pruneStep_trashDirectory"] = this.getTrashDirectory();
  }
}
