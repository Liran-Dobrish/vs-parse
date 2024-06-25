'use strict';
import * as lib from './src/lib'
import * as project from './src/csproj'
import * as sln from './src/sln'

export = {
  parseSemverSync: lib.parseSemverSync,
  parsePackages: project.parsePackages,
  parsePackagesSync: project.parsePackagesSync,
  parseProject: project.parseProject,
  parseProjectSync: project.parseProjectSync,
  parseSolution: sln.parseSolution,
  parseSolutionSync: sln.parseSolutionSync,
};