'use strict';

import * as path from 'path';
import * as csproj from './csproj';
import * as helpers from './internal';

class ProjectReference {
  id: string = ''
  name: string = ''
  relativePath: string = ''
  projectTypeId: string = ''
}

class Sln {
  fileFormatVersion: string = ''
  visualStudioVersion: string = ''
  minimumVisualStudioVersion: string = ''
  projects: ProjectReference[] = []
}

function parseMinimumVisualStudioVersion(lineOfText: string): string | null {
  let regex: RegExp = /^MinimumVisualStudioVersion = (\d+(\.\d+){3})/;
  let result: RegExpExecArray | null = regex.exec(lineOfText);

  return result && result[1];
};

function parseVisualStudioVersion(lineOfText: string): string | null {
  let regex: RegExp = /^VisualStudioVersion = (\d+(\.\d+){3})/;
  let result: RegExpExecArray | null = regex.exec(lineOfText);

  return result && result[1];
};

function parseFileFormatVersion(lineOfText: string): string | null {
  let regex: RegExp = /^Microsoft Visual Studio Solution File, Format Version (\d+\.\d+)/;
  let result: RegExpExecArray | null = regex.exec(lineOfText);

  return result && result[1];
};

function parseSolutionProject(lineOfText: string): ProjectReference | undefined {
  let regex: RegExp = /^Project\("\{([A-Z0-9]{8}\-[A-Z0-9]{4}\-[A-Z0-9]{4}\-[A-Z0-9]{4}\-[A-Z0-9]{12})\}"\) = "([^"]+)", "([^"]+)", "\{([A-Z0-9]{8}\-[A-Z0-9]{4}\-[A-Z0-9]{4}\-[A-Z0-9]{4}\-[A-Z0-9]{12})\}"/;
  let result: RegExpExecArray | null = regex.exec(lineOfText);

  if (result) {
    return {
      id: result[4],
      name: result[2],
      relativePath: helpers.normalizePath(result[3]),
      projectTypeId: result[1],
    }
  }
};

export function parseSolution(filePath: string, options: helpers.ParseOptions) {
  const providedOptions = options || {};
  return helpers.getFileContentsOrFail(filePath)
    .then(contents => {
      const returnValue = parseSolutionInternal(contents);

      if (providedOptions.deepParse) {
        const slnDir = helpers.getFileDirectory(filePath, options);

        const projectPromises = returnValue.projects.map(project => {
          if (project && project.relativePath) {
            const projectLocation = path.join(slnDir, project.relativePath);

            return helpers.fileExists(projectLocation)
              .then(exists => {
                return exists ? csproj.parseProject(projectLocation, providedOptions) : null;
              });
          } else {
            return null;
          }
        });

        return Promise.all(projectPromises).then(fullProjects => {
          for (let i = 0; i < returnValue.projects.length; i++) {
            const projectData = fullProjects[i];
            if (projectData) {
              returnValue.projects[i] = Object.assign({}, returnValue.projects[i], projectData);
            }
          }

          return returnValue;
        });
      }

      return returnValue;
    });
};

export function parseSolutionSync(filePath: string, options: helpers.ParseOptions) {
  const providedOptions = options || {};
  const contents = helpers.getFileContentsOrFailSync(filePath);
  const returnValue = parseSolutionInternal(contents);

  if (providedOptions.deepParse) {
    const slnDir = helpers.getFileDirectory(filePath, options);

    for (let i = 0; i < returnValue.projects.length; i++) {
      const project = returnValue.projects[i];

      if (project && project.relativePath) {
        const projectLocation = path.join(slnDir, project.relativePath);

        if (helpers.fileExistsSync(projectLocation)) {
          const projectData = csproj.parseProjectSync(projectLocation, providedOptions);

          if (projectData) {
            returnValue.projects[i] = Object.assign({}, project, projectData);
          }
        }
      }
    }
  }

  return returnValue;
};

function parseSolutionInternal(contents: string): Sln {
  const lines = contents.replace(/(\r\n|\r)/g, '\n').split('\n');

  const returnValue:Sln = new Sln();

  for (let i = 0; i < lines.length; i++) {
    let solutionProject: ProjectReference | undefined = parseSolutionProject(lines[i]);
    if (solutionProject !== undefined) {
      returnValue.projects.push(solutionProject);
    }

    const fileFormatVersion = parseFileFormatVersion(lines[i]);
    if (fileFormatVersion) {
      returnValue.fileFormatVersion = fileFormatVersion;
    }

    const visualStudioVersion = parseVisualStudioVersion(lines[i]);
    if (visualStudioVersion) {
      returnValue.visualStudioVersion = visualStudioVersion;
    }

    const minimumVisualStudioVersion = parseMinimumVisualStudioVersion(lines[i]);
    if (minimumVisualStudioVersion) {
      returnValue.minimumVisualStudioVersion = minimumVisualStudioVersion;
    }
  }

  return returnValue;
}