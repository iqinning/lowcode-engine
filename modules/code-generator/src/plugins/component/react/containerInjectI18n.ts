import {
  CLASS_DEFINE_CHUNK_NAME,
  COMMON_CHUNK_NAME,
  DEFAULT_LINK_AFTER,
} from '../../../const/generator';

import {
  BuilderComponentPlugin,
  BuilderComponentPluginFactory,
  ChunkType,
  FileType,
  ICodeStruct,
} from '../../../types';

export interface PluginConfig {
  fileType: string;
}

const pluginFactory: BuilderComponentPluginFactory<PluginConfig> = (config?) => {
  const cfg: PluginConfig = {
    fileType: FileType.JSX,
    ...config,
  };

  const plugin: BuilderComponentPlugin = async (pre: ICodeStruct) => {
    const next: ICodeStruct = {
      ...pre,
    };

    next.chunks.push({
      type: ChunkType.STRING,
      fileType: cfg.fileType,
      name: COMMON_CHUNK_NAME.InternalDepsImport,
      // TODO: 下面这个路径有没有更好的方式来获取？而非写死
      content: `
        import { i18n as _$$i18n } from '../../i18n';
      `,
      linkAfter: [COMMON_CHUNK_NAME.ExternalDepsImport],
    });

    next.chunks.push({
      type: ChunkType.STRING,
      fileType: cfg.fileType,
      name: CLASS_DEFINE_CHUNK_NAME.InsMethod,
      content: `
        i18n = (i18nKey) => {
          return _$$i18n(i18nKey);
        }
      `,
      linkAfter: [...DEFAULT_LINK_AFTER[CLASS_DEFINE_CHUNK_NAME.InsMethod]],
    });

    return next;
  };
  return plugin;
};

export default pluginFactory;
