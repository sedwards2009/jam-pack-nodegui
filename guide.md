Guide
=====

# Overview

JPN can produce packages in the following formats:

* Zip (all operating systems)
* AppImage (Linux)
* Debian (Linux)
* NSIS installer (Windows)
* DMG (macOS)

JPN is a command line utility which takes a JSON configuration file as a parameter. For example:

`jam-pack-nodegui --config jam-pack-config.json`

The configuration JSON file defines all the details about how JPN should perform each step of packaging.

The same configuration file is used to build each platform. When JPN runs it will build the packages for the operating system it is running on. To build for multiple operating systems you must run JPN on each different system, ideally as part of some kind of automated pipeline.

# Writing a jam-pack-config.json file

`jam-pack-config.json` (it could have a different name) is a JSON configuration file. At the top level

## Fetch Step

The first step executed when building a package, and generally the first thing to specify in your configuration is the location of the source code. When JPN runs it will use git to clone the repository to get a clean copy of the source code.

You can use `gitUrl` to specify the URL of the respository itself.

For example:

    "fetch": {
      "gitUrl": "git@github.com:sedwards2009/test-nodegui-app.git"
    }

If you keep the configuration for JPN in the same git respository as the application source code, then you can use `gitFromCwd` instead to use the current git repository to find the remote URL.

For example:

    "fetch": {
      "gitFromCwd": true
    }

If you are using the complete git URL, then you can also specify a branch name with `gitBranch`.

## Build Step

Once the source code has been downloaded to a work folder, it usually has to be built. The build step will first install Node packages using `npm install` or `yarn install`, and then it will run a build command which must be a script defined within `package.json`.

A minimal, but functional cofiguration for the build step is:

    "build": {
    }

By default the name of the package.json script to build the software is `build`. This can be changed by specifying the `scriptName` inside the build configuration.

If you are using a package manager other than the default `npm`, then you can specify its name in the `packageManager` field. This could be `yarn` or any other package manager which has the same command line interface as `npm` and `yarn`.

The build step is also the step where the name of the application and its version is found. This is done automatically by looking at the values in the `package.json` file. It is also possible to specify this directly in the coniguration file using the `applicationName` and `applicationVersion` fields.

A more complicated build configuration could look like:

    "build": {
      "packageManager": "yarn",
      "scriptName": "build-all",
      "applicationName": "SuperApp",
      "applicationVersion": "1.1.0"
    }

## Prune Step

TODO

## Quiet Qode Step (Windows)

TODO

## Add Launcher Step

TODO

## Zip Step (all platforms)

TODO

## Debian Package Step (Linux)

TODO

## NSIS Installer Step (Windows)

TODO

## AppImage Step (Linux)

TODO

## DMG Step (macOS)

TODO


Steps of the Packaging Process
------------------------------

The packaging process involves several high-level steps:

* **Prepare:** This step prepares the environment for the packaging process by setting up any necessary directories or files.
* **Fetch:** This step fetches the necessary resources required for the packaging process, such as source code or dependencies.
* **Build:** This step builds the application using the fetched resources and any other required configurations.
* **Prune:** This step deletes and cleans up many files inside the NodeGui package which are not needed to run the application on end user's machines.
* **Quiet Qode**: (Windows only) This step modifies the `qode.exe` executable to prevent it from showing a Windows console window when launching the application.
* **Add Launcher**: This step adds a small launcher executable to make it easier for people to run the application from the desktop. On some operating systems it may hold the application icon too.
* **Zip**: This step packages the built application into a zip file for distribution.
* **Debian**: (Linux only) This step creates a Debian package of the application, allowing it to be easily installed on Debian-based Linux distributions.
* **App Image**: (Linux only) This step creates an AppImage of the application, which is a self-contained executable file that can be run on various Linux distributions without requiring installation.
* **NSIS**: (Windows only) This step creates an installer for the application using [NSIS:Nullsoft Scriptable Install System](https://sourceforge.net/projects/nsis/).
* **DMG**: (macOS only) This step creates a disk image (dmg) of the application, allowing it to be easily distributed on macOS.

These steps are executed in order, and any errors encountered during the execution of a step will cause the entire packaging process to fail.
