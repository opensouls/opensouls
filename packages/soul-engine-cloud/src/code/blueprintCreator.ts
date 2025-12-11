
import fs from 'fs/promises';
import Mustache from 'mustache';
import { safeName } from '../safeName.ts';

const blueprintTemplate = `
{{#imports}}
import {{name}} from "{{& path}}";
{{/imports}}

const blueprint = {
  name: "{{& name}}",
  entity: "{{& entityName}}",
  context: \`
{{& context}}
  \`.trim(),
  initialProcess: {{initialProcess}},
  mentalProcesses: [
    {{#mentalProcesses}}
      {{name}},
    {{/mentalProcesses}}
  ],
  subprocesses: [
    {{#subprocesses}}
      {{name}},
    {{/subprocesses}}
  ],
  perceptionProcessor: {{perceptionProcessor}},
  memoryIntegrator: {{memoryIntegrator}},
  defaultEnvironment: {{& defaultEnv}},
  defaultModel: "{{defaultModel}}",
  soul: {{userSoulTs}},
}

export default blueprint
`.trim()


interface ImportStatement {
  name: string;
  path: string
}

const MARKDOWN_COMMENT_REGEX = /<!--[\s\S]*?-->/g;

const stripMarkdownComments = (markdownContent: string): string => {
  // Regular expression to match HTML-style comments
  return markdownContent.replace(MARKDOWN_COMMENT_REGEX, '');
}

const escapeTicks = (str: string): string => {
  return str.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

export class BlueprintCreator {
  
  constructor(private basePath: string) {}

  async create() {
    return Mustache.render(blueprintTemplate, await this.bluePrintTemplateVars());
  }

  private async bluePrintTemplateVars() {
    const [
      { name, soulEngine },
      { entityName, context },
      initialProcess,
      mentalProcesses,
      subprocesses,
      perceptionProcessor,
      memoryIntegrator,
      defaultEnv,
      userSoulTs,
    ] = await Promise.all([
      this.parsedPackageJson(),
      this.entityNameAndContext(),
      this.initialProcess(),
      this.mentalProcesses(),
      this.subprocesses(),
      this.perceptionProcessor(),
      this.memoryIntegrator(),
      this.defaultEnv(),
      this.userSoulTs(),
    ])

    let defaultModel = ''
    if (soulEngine && soulEngine.defaultModel) {
      defaultModel = soulEngine.defaultModel
    }

    return {
      name,
      defaultModel,
      entityName,
      context,
      initialProcess: initialProcess.name,
      imports: [
        initialProcess, 
        ...mentalProcesses, 
        ...subprocesses, 
        ...(perceptionProcessor ? [perceptionProcessor] : []),
        ...(memoryIntegrator ? [memoryIntegrator] : []),
        ...(userSoulTs ? [userSoulTs] : []),
      ],
      mentalProcesses: [{ name: initialProcess.name }].concat(mentalProcesses.map(mentalProcess => ({name: mentalProcess.name}))),
      subprocesses: subprocesses.map(subprocess => ({name: subprocess.name})),
      perceptionProcessor: perceptionProcessor ? perceptionProcessor.name : 'undefined',
      memoryIntegrator: memoryIntegrator ? memoryIntegrator.name : 'undefined',
      userSoulTs: userSoulTs ? userSoulTs.name : 'undefined',
      defaultEnv: defaultEnv,
    }
  }

  private async entityNameAndContext() {
    const soulPath = `${this.basePath}/soul`;

    if (await this.userSoulTsExists()) {
      // these will be
      return {
        entityName: undefined,// safeName('^'),
        context: undefined,
      }
    }

    const mdFiles = (await fs.readdir(soulPath)).filter(file => file.endsWith('.md'));
    if (mdFiles.length === 0) {
      throw new Error('No markdown files found in the soul directory.');
    }
    const entityName = safeName(mdFiles[0].slice(0, -3)); // Remove the '.md' extension to get the entity name
    const context = escapeTicks(
      stripMarkdownComments(
        await fs.readFile(`${soulPath}/${mdFiles[0]}`, 'utf8')
      )
    ).trim()

    return { entityName, context };
  }

  private async userSoulTs() {
    if (await this.userSoulTsExists()) {
      return {
        name: 'userSoul',
        path: "./soul/soul.ts",
      }
    }
    return undefined
  }
  
  private async userSoulTsExists() {
    const soulPath = `${this.basePath}/soul/soul.ts`;
    return await fs.exists(soulPath);
  }

  private async initialProcess(): Promise<ImportStatement> {
    return {
      name: 'initialProcess',
      path: "./soul/initialProcess"
    }
  }

  private async perceptionProcessor(): Promise<ImportStatement | undefined> {
    const pathToPerceptionProcessor = `${this.basePath}/soul/perceptionProcessor.ts`;
    if (await fs.exists(pathToPerceptionProcessor)) {
      return {
        name: 'perceptionProcessor',
        path: './soul/perceptionProcessor.ts'
      }
    }

    return undefined
  }

  private async memoryIntegrator(): Promise<ImportStatement | undefined> {
    const pathToPerceptionProcessor = `${this.basePath}/soul/memoryIntegrator.ts`;
    if (await fs.exists(pathToPerceptionProcessor)) {
      return {
        name: 'memoryIntegrator',
        path: './soul/memoryIntegrator.ts'
      }
    }

    return undefined
  }

  private async mentalProcesses(): Promise<ImportStatement[]> {
    const mentalProcessesPath = `${this.basePath}/soul/mentalProcesses`;
    if (!await fs.exists(mentalProcessesPath)) {
      return [];
    }
    const mentalProcessFiles = (await fs.readdir(mentalProcessesPath)).filter(file => file.endsWith('.ts'));
    return mentalProcessFiles.map(file => {
      const name = file.slice(0, -3)
      return {
        name,
        path: `./soul/mentalProcesses/${file}`
      }
    });
  }

  private async subprocesses(): Promise<ImportStatement[]> {
    const subprocessesPath = `${this.basePath}/soul/subprocesses`;
    if (!await fs.exists(subprocessesPath)) {
      return [];
    }
    const subprocessFiles = (await fs.readdir(subprocessesPath)).filter(file => file.endsWith('.ts'));
    return subprocessFiles.map(file => {
      const name = file.slice(0, -3) // Remove the '.ts' extension to get the name
      return {
        name,
        path: `./soul/subprocesses/${file}`
      }
    });
  }

  private async defaultEnv(): Promise<string> {
    const defaultEnvPath = `${this.basePath}/soul/default.env.ts`;
    if (await fs.exists(defaultEnvPath)) {
      const contents = await fs.readFile(defaultEnvPath, 'utf8')
      // handle an empty file
      if (!contents) {
        return "undefined"
      }
      return contents
    }
    return "undefined";
  }

  private async parsedPackageJson() {
    const packageJsonPath = `${this.basePath}/package.json`;
    const packageJson = await fs.readFile(packageJsonPath, 'utf8');
    return JSON.parse(packageJson);
  }
}
