/* eslint-disable no-multi-assign */
import { Editor, EngineConfig, engineConfig } from '@alilc/lowcode-editor-core';
import { Designer, ILowCodePluginManager } from '@alilc/lowcode-designer';
import { Skeleton as InnerSkeleton } from '@alilc/lowcode-editor-skeleton';
import {
  Hotkey,
  Project,
  Skeleton,
  Setters,
  Material,
  Event,
  editorSymbol,
  designerSymbol,
  skeletonSymbol,
} from '@alilc/lowcode-shell';
import { getLogger, Logger } from '@alilc/lowcode-utils';
import {
  ILowCodePluginContext,
  PluginContextOptions,
  ILowCodePluginPreferenceDeclaration,
  PreferenceValueType,
  IPluginPreferenceMananger,
} from './plugin-types';

export default class PluginContext implements ILowCodePluginContext {
  private readonly [editorSymbol]: Editor;
  private readonly [designerSymbol]: Designer;
  private readonly [skeletonSymbol]: InnerSkeleton;
  hotkey: Hotkey;
  project: Project;
  skeleton: Skeleton;
  logger: Logger;
  setters: Setters;
  material: Material;
  config: EngineConfig;
  event: Event;
  plugins: ILowCodePluginManager;
  preference: IPluginPreferenceMananger;

  constructor(plugins: ILowCodePluginManager, options: PluginContextOptions) {
    const editor = this[editorSymbol] = plugins.editor;
    const designer = this[designerSymbol] = editor.get('designer')!;
    const skeleton = this[skeletonSymbol] = editor.get('skeleton')!;

    const { pluginName = 'anonymous' } = options;
    const project = designer?.project;
    this.hotkey = new Hotkey();
    this.project = new Project(project);
    this.skeleton = new Skeleton(skeleton);
    this.setters = new Setters();
    this.material = new Material(editor);
    this.config = engineConfig;
    this.plugins = plugins;
    this.event = new Event(editor, { prefix: 'common' });
    this.logger = getLogger({ level: 'warn', bizName: `designer:plugin:${pluginName}` });
  }

  setPreference(
    pluginName: string,
    preferenceDeclaration: ILowCodePluginPreferenceDeclaration,
  ): void {
    const isValidPreferenceKey = (key: string): boolean => {
      if (!preferenceDeclaration || !Array.isArray(preferenceDeclaration.properties)) {
        return false;
      }
      return preferenceDeclaration.properties.some((prop) => {
        return prop.key === key;
      });
    };

    const getPreferenceValue = (
      key: string,
      defaultValue?: PreferenceValueType,
      ): PreferenceValueType | undefined => {
      if (!isValidPreferenceKey(key)) {
        return undefined;
      }
      const pluginPreference = this.plugins.getPluginPreference(pluginName) || {};
      if (pluginPreference[key] === undefined || pluginPreference[key] === null) {
        return defaultValue;
      }
      return pluginPreference[key];
    };

    this.preference = {
      getPreferenceValue,
    };
  }
}
