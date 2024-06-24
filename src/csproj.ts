import parseXml from 'xml-parser';
import * as path from 'path';
import * as helpers from './internal';

class CodeFile {
  fileName: string = ''
}

class PackageReference {
  name: string = ''
  version: string = ''
  targetFramework: string = ''
}

class AssemblyReference {
  assemblyName: string = ''
  version: string | null = null
  culture: string | null = null
  processorArchitecture: string | null = null
  publicKeyToken: string | null = null
  hintPath: string | null = null
}

class Project {
  references: AssemblyReference[] = []
  codeFiles: CodeFile[] = []
  packages: PackageReference[] = []
}

function parseCodeFile(node: parseXml.Node): CodeFile {
  let fileName = node.attributes.Include;

  return {
    fileName: helpers.normalizePath(fileName)
  };
};

function parsePackageReference(detail: parseXml.Node): PackageReference {
  return {
    name: detail.attributes.Include,
    version: detail.attributes.Version,
    targetFramework: detail.attributes.targetFramework,
  };
};

function parseAssemblyReference(node: parseXml.Node): AssemblyReference {
  const parts = node.attributes.Include.split(/\, /g);
  const hintPathNode = node.children && node.children[0];

  let result: AssemblyReference = new AssemblyReference();
  result.assemblyName = parts[0];

  for (let i = 1; i < parts.length; i++) {
    const asmPartKeyValue = parts[i].split(/=/g);

    if (asmPartKeyValue.length === 2) {
      if (asmPartKeyValue[0] === 'Version') {
        result.version = asmPartKeyValue[1];
      } else if (asmPartKeyValue[0] === 'Culture') {
        result.culture = asmPartKeyValue[1];
      } else if (asmPartKeyValue[0] === 'processorArchitecture') {
        result.processorArchitecture = asmPartKeyValue[1];
      } else if (asmPartKeyValue[0] === 'PublicKeyToken') {
        result.publicKeyToken = asmPartKeyValue[1];
      }
    }
  }

  if (hintPathNode && hintPathNode.name === 'HintPath' && hintPathNode.content) {
    result.hintPath = helpers.normalizePath(hintPathNode.content);
  }

  return result;
};

export function parsePackages(filePath: string): Promise<PackageReference[]> {
  return helpers.getFileContentsOrFail(filePath)
    .then(parsePackagesInternal);
};

export function parsePackagesSync(filePath: string): PackageReference[] {
  let contents = helpers.getFileContentsOrFailSync(filePath);
  return parsePackagesInternal(contents);
};

function parsePackagesInternal(contents: string) {
  let xml: parseXml.Document = parseXml(contents);

  return xml.root.children.reduce((data: PackageReference[], packageNode: parseXml.Node) => {
    if (packageNode.name === 'package') {
      let parsedPackage: PackageReference = {
        name: packageNode.attributes.id,
        version: packageNode.attributes.version,
        targetFramework: packageNode.attributes.targetFramework,
      };

      data.push(parsedPackage);
    }

    return data;
  }, []);
};

// function mergePackages(projPackages, packages) {
//   let result = [];
//   if (projPackages) {
//     result.push(...projPackages);
//   }
//   if (packages) {
//     result.push(...packages);
//   }

//   return result;
// };

export function parseProject(filePath: string, options: helpers.ParseOptions): Promise<Project> {
  const providedOptions = options || {};
  return helpers.getFileContentsOrFail(filePath)
    .then(contents => {
      let result: Project = parseProjectInternal(contents);

      if (!providedOptions.deepParse) {
        return result;
      } else {
        const projDir = helpers.getFileDirectory(filePath, options);
        const packagesLocation = path.join(projDir, 'packages.config');

        return helpers.fileExists(packagesLocation)
          .then(exists => {
            if (!exists) {
              return result;
            } else {
              return parsePackages(packagesLocation)
                .then(packages => {
                  result.packages = packages || [];
                  return result;
                });
            }
          });
      }
    });
};

export function parseProjectSync(filePath: string, options: helpers.ParseOptions): Project {
  const providedOptions = options || {};
  const contents = helpers.getFileContentsOrFailSync(filePath);
  const result = parseProjectInternal(contents);

  if (providedOptions.deepParse) {
    let projDir = helpers.getFileDirectory(filePath, options);
    let packagesLocation = path.join(projDir, 'packages.config');

    let packages = helpers.fileExistsSync(packagesLocation) && parsePackagesSync(packagesLocation);
    result.packages = packages || [];
  }

  return result;
};

function parseProjectInternal(contents: string) {
  let xml: parseXml.Document = parseXml(contents);

  if (!xml || !xml.root) {
    throw new Error('No root element in project file');
  }

  return xml.root.children.reduce((projectData: Project, directChild:parseXml.Node) => {
    if (directChild.name === 'ItemGroup') {
      const children = directChild.children;

      // TODO: Sequential dynamic mapping instead of assuming all children are same
      if (children && children.length) {
        if (children[0].name === 'Reference') {
          let refs: AssemblyReference[] = children.map(parseAssemblyReference);
          projectData.references = projectData.references.concat(refs);
        } else if (children[0].name === 'Compile' && children[0].attributes.Include) {
          let refs: CodeFile[] = children.map(parseCodeFile);
          projectData.codeFiles = projectData.codeFiles.concat(refs);
        } else if (children[0].name === 'PackageReference') {
          let refs: PackageReference[] = children.map(parsePackageReference);
          projectData.packages = projectData.packages.concat(refs);
        }
      }
    }

    return projectData;
  }, {
    references: [],
    codeFiles: [],
    packages: [],
  });
}
