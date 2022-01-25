import { Editor } from '@alilc/lowcode-editor-core';
import { getLogger } from '@alilc/lowcode-utils';
import {
  ILowCodePlugin,
  ILowCodePluginConfig,
  ILowCodePluginManager,
  ILowCodePluginContext,
  LowCodeRegisterOptions,
  PluginContextOptions,
  PreferenceValueType,
  ILowCodePluginConfigMeta,
  PluginPreference,
  ILowCodePluginPreferenceDeclaration,
} from './plugin-types';
import { LowCodePlugin } from './plugin';
import LowCodePluginContext from './plugin-context';
import { invariant } from '../utils';
import sequencify from './sequencify';

const logger = getLogger({ level: 'warn', bizName: 'designer:pluginManager' });

export class LowCodePluginManager implements ILowCodePluginManager {
  private plugins: ILowCodePlugin[] = [];

  private pluginsMap: Map<string, ILowCodePlugin> = new Map();

  private pluginPreference?: PluginPreference = new Map();
  private editor: Editor;

  constructor(editor: Editor) {
    this.editor = editor;
  }

  private _getLowCodePluginContext(options: PluginContextOptions) {
    return new LowCodePluginContext(this, options);
  }

  async register(
    pluginConfigCreator: (ctx: ILowCodePluginContext) => ILowCodePluginConfig,
    options?: LowCodeRegisterOptions,
  ): Promise<void> {
    const { pluginName, meta = {} } = pluginConfigCreator as any;
    const { preferenceDeclaration } = meta as ILowCodePluginConfigMeta;
    const ctx = this._getLowCodePluginContext({ pluginName });
    const config = pluginConfigCreator(ctx);

    invariant(
      pluginName,
      'pluginConfigCreator.pluginName required',
      config,
    );

    ctx.setPreference(pluginName, (preferenceDeclaration as ILowCodePluginPreferenceDeclaration));

    const allowOverride = options?.override === true;

    if (this.pluginsMap.has(pluginName)) {
      if (!allowOverride) {
        throw new Error(`Plugin with name ${pluginName} exists`);
      } else {
        // clear existing plugin
        const originalPlugin = this.pluginsMap.get(pluginName);
        logger.log(
          'plugin override, originalPlugin with name ',
          pluginName,
          ' will be destroyed, config:',
          originalPlugin?.config,
        );
        originalPlugin?.destroy();
        this.pluginsMap.delete(pluginName);
      }
    }
    const plugin = new LowCodePlugin(pluginName, this, config);
    if (options?.autoInit) {
      await plugin.init();
    }
    this.plugins.push(plugin);
    this.pluginsMap.set(pluginName, plugin);
    logger.log('plugin registered with config:', config);
  }

  get(pluginName: string): ILowCodePlugin | undefined {
    return this.pluginsMap.get(pluginName);
  }

  getAll(): ILowCodePlugin[] {
    return this.plugins;
  }

  has(pluginName: string): boolean {
    return this.pluginsMap.has(pluginName);
  }

  async delete(pluginName: string): Promise<boolean> {
    const idx = this.plugins.findIndex((plugin) => plugin.name === pluginName);
    if (idx === -1) return false;
    const plugin = this.plugins[idx];
    await plugin.destroy();

    this.plugins.splice(idx, 1);
    return this.pluginsMap.delete(pluginName);
  }

  async init(pluginPreference?: PluginPreference) {
    const pluginNames: string[] = [];
    const pluginObj: { [name: string]: ILowCodePlugin } = {};
    this.pluginPreference = pluginPreference;
    this.plugins.forEach((plugin) => {
      pluginNames.push(plugin.name);
      pluginObj[plugin.name] = plugin;
    });
    const { missingTasks, sequence } = sequencify(pluginObj, pluginNames);
    invariant(!missingTasks.length, 'plugin dependency missing', missingTasks);
    logger.log('load plugin sequence:', sequence);

    for (const pluginName of sequence) {
      try {
        await this.pluginsMap.get(pluginName)!.init();
      } catch (e) {
        logger.error(
          `Failed to init plugin:${pluginName}, it maybe affect those plugins which depend on this.`,
        );
        logger.error(e);
      }
    }
  }

  async destroy() {
    for (const plugin of this.plugins) {
      await plugin.destroy();
    }
  }

  get size() {
    return this.pluginsMap.size;
  }

  getPluginPreference(pluginName: string): Record<string, PreferenceValueType> | null | undefined {
    if (!this.pluginPreference) {
      return null;
    }
    return this.pluginPreference.get(pluginName);
  }

  toProxy() {
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (target.pluginsMap.has(prop as string)) {
          // 禁用态的插件，直接返回 undefined
          if (target.pluginsMap.get(prop as string)!.disabled) {
            return undefined;
          }
          return target.pluginsMap.get(prop as string)?.toProxy();
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  setDisabled(pluginName: string, flag = true) {
    logger.warn(`plugin:${pluginName} has been set disable:${flag}`);
    this.pluginsMap.get(pluginName)?.setDisabled(flag);
  }

  async dispose() {
    await this.destroy();
    this.plugins = [];
    this.pluginsMap.clear();
  }
}
