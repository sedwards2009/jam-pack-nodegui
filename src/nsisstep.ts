/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import fs from 'node:fs';
import * as path from "node:path";
import copy from 'recursive-copy';
import shell from "shelljs";
import {fileURLToPath} from 'node:url';

import { BuildStep } from "./buildstep.js";
import { CommandList } from './commandlist.js';
import { NSISConfig } from "./config.js";
import { FetchStep } from "./fetchstep.js";
import { Logger } from "./logger.js";
import { PrepareStep } from "./preparestep.js";
import { PruneStep } from './prunestep.js';
import { executeCommandAndCaptureOutput, getPlatform } from "./utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NSIS_SOURCE_NAME = "nsis_source";

export class NSISStep {
  #config: NSISConfig;
  #commandList: CommandList;
  #nsisSourceDirectory = "";

  constructor(config: NSISConfig) {
    this.#config = config;
    this.#commandList = new CommandList(config.prePack);
  }

  #isSkip(): boolean {
    return this.#config.skip || getPlatform() !== "windows";
  }

  async preflightCheck(logger: Logger): Promise<boolean> {
    if (this.#isSkip()) {
      logger.subsection("NSIS step (skipping)");
      return true;
    }
    logger.subsection("NSIS step");

    const {result, output } = await executeCommandAndCaptureOutput(`makensis /VERSION`);
    if (result === 0) {
      logger.checkOk(`Found 'makensis' command version: ${output.trim()}`);
    } else {
      logger.checkError(`Unable to run 'makensis /VERSION'. Command reported: ${output}`);
      return false;
    }

    if ( ! await this.#commandList.preflightCheck(logger, "prePack")) {
      return false
    }

    return true;
  }

  async execute(logger: Logger, prepareStep: PrepareStep, fetchStep: FetchStep, buildStep: BuildStep, pruneStep: PruneStep): Promise<boolean> {
    if (this.#isSkip()) {
      logger.subsection("NSIS step (skipping)");
      return true;
    }
    logger.subsection("NSIS step");

    const nsisSourcePath = path.join(prepareStep.getTempDirectory(),
      NSIS_SOURCE_NAME);

    logger.info("Copying source to NSIS directory.");

    try {
      await copy(fetchStep.getSourcePath(), nsisSourcePath, {
        dot: true,
	      junk: true,
      });
    } catch (error) {
      logger.error('Copy failed: ' + error);
      return false;
    }

    this.#nsisSourceDirectory = path.join(prepareStep.getTempDirectory(), NSIS_SOURCE_NAME);

    const env: { [key: string]: string } = {};
    prepareStep.addVariables(env);
    fetchStep.addVariables(env);
    buildStep.addVariables(env);
    pruneStep.addVariables(env);
    this.addVariables(env);
    if ( ! await this.#commandList.execute(logger, env)) {
      return false;
    }

    fs.writeFileSync(path.join(prepareStep.getTempDirectory(), "installer.nsi"), this.#getInstallerNsi(buildStep), {encoding: "utf-8"});

    shell.cd(prepareStep.getTempDirectory());
    const command = `makensis installer.nsi`;
    const result = shell.exec(command);
    if (result.code !== 0) {
      logger.error(`Something went wrong while running command '${command}'`);
      return false;
    }

    // const debBaseName = `${buildStep.getApplicationName()}_${buildStep.getApplicationVersion()}_amd64.deb`;
    // shell.mv(`${NSIS_SOURCE_NAME}.deb`, debBaseName);

    logger.info(`Created NSIS installer: `);

    return true;
  }

  #getInstallerNsi(buildStep: BuildStep): string {
    const version = buildStep.getApplicationVersion();
    const APP_NAME = buildStep.getApplicationName();
    const APP_TITLE = buildStep.getApplicationName();
    const windowsBuildDirName = `${APP_NAME}-${version}-win32-x64`;
    const versionSplit = version.split(".");
    const majorVersion = versionSplit[0];
    const minorVersion = versionSplit[1];
    const patchVersion = versionSplit[2];

    let appName = `"${APP_TITLE}"`;
    if (this.#config.appTitle != null) {
      appName = `"${escapeString(this.#config.appTitle)}" "${escapeStringDoubleAmp(this.#config.appTitle)}"`;
    }

    const smallIconPath = path.join(__dirname, "../resources/icons/small_logo.ico");
    let installerIconPath = smallIconPath;
    let uninstallerIconPath = smallIconPath;

    const installerScript = `
!include "MUI2.nsh"
!include "FileFunc.nsh"

!define APPNAME "${APP_TITLE}"
!define DESCRIPTION "${escapeString(this.#config.description ?? "")}"
!define COMPANYNAME "${escapeString(this.#config.companyName ?? "")}"
!define VERSIONMAJOR ${majorVersion}
!define VERSIONMINOR ${minorVersion}
!define VERSIONBUILD ${patchVersion}

!define MUI_ABORTWARNING # This will warn the user if they exit from the installer.
${this.#config.detailColors != null ? '!define MUI_INSTFILESPAGE_COLORS "' + this.#config.detailColors + '"' : ""}
!define MUI_ICON "${installerIconPath}"
!define MUI_UNICON "${uninstallerIconPath}"

!insertmacro MUI_PAGE_WELCOME # Welcome to the installer page.
!insertmacro MUI_PAGE_DIRECTORY # In which folder install page.
!insertmacro MUI_PAGE_INSTFILES # Installing page.
!insertmacro MUI_PAGE_FINISH # Finished installation page.

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Name ${appName}
BrandingText " "
OutFile "${APP_NAME}-setup-${version}.exe"
InstallDir "$PROGRAMFILES64\\${APP_TITLE}"
InstallDirRegKey HKLM "Software\\${APP_TITLE}" "InstallLocation"

ShowInstDetails show # This will always show the installation details.

Section "${APP_TITLE}"
SetOutPath $INSTDIR
File /r "${NSIS_SOURCE_NAME}\\*"

WriteUninstaller "$INSTDIR\\Uninstall.exe"

createShortCut "$SMPROGRAMS\\${APP_TITLE}.lnk" "$INSTDIR\\${APP_NAME}.exe" "" "$INSTDIR\\main\\resources\\logo\\extraterm_small_logo.ico"

WriteRegStr HKLM "Software\\${APP_TITLE}" "InstallLocation" "$\\"$INSTDIR$\\""
WriteRegStr HKLM "Software\\${APP_TITLE}" "Version" "${version}"

# Registry information for add/remove programs
WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "DisplayName" "\${APPNAME} - \${DESCRIPTION}"
WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "UninstallString" "$\\"$INSTDIR\\uninstall.exe$\\""
WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "QuietUninstallString" "$\\"$INSTDIR\\uninstall.exe$\\" /S"
WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "InstallLocation" "$\\"$INSTDIR$\\""
WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "DisplayIcon" "$\\"$INSTDIR\\main\\resources\\logo\\extraterm_small_logo.ico$\\""
WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "Publisher" "\${COMPANYNAME}"

WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "DisplayVersion" "\${VERSIONMAJOR}.\${VERSIONMINOR}.\${VERSIONBUILD}"
WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "VersionMajor" \${VERSIONMAJOR}
WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "VersionMinor" \${VERSIONMINOR}
# There is no option for modifying or repairing the install
WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "NoModify" 1
WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "NoRepair" 1
# Set the INSTALLSIZE constant (!defined at the top of this script) so Add/Remove Programs can accurately report the size

# Record the installation size
\${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
IntFmt $0 "0x%08X" $0
WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "EstimatedSize" "\$0"

SectionEnd

Section "Uninstall"
# Remove Start Menu launcher
Delete "$SMPROGRAMS\\${APP_TITLE}.lnk"

Delete "$INSTDIR\\*.*"
Delete "$INSTDIR\\Uninstall.exe"
RMDir /r "$INSTDIR"

DeleteRegKey HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}"
DeleteRegKey HKLM "Software\\${APP_TITLE}"

SectionEnd
`;
    return installerScript;
  }

  getNSISSourceDirectory(): string {
    return this.#nsisSourceDirectory;
  }

  addVariables(variables: {[key: string]: string}): void {
    variables["nsisStep.nsisSourceDirectory"] = this.getNSISSourceDirectory();
  }
}

function escapeString(str: string): string {
  return str.replaceAll('"', '\\"');
}

function escapeStringDoubleAmp(str: string): string {
  return escapeString(str).replaceAll("&", "&&");
}
