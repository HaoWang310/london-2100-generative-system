// NN · Module name — copy this folder to modules/NN-your-module/ to start.
// Import only from ../../shared/ — never from another module.

import { createBundle } from '../../shared/schemas/index.js';

const mod = {
  id: '99-your-module',          // = folder name, e.g. '06-blocks'
  level: 'tensor',               // london | region | wool | tensor | integration
  version: '0.1.0',
  title: { zh: '模块名称', en: 'Module name' },
  description: { zh: '一句话说明。', en: 'One-line description.' },
  params: [
    { key: 'example', type: 'range', min: 0, max: 10, step: 1, default: 5,
      label: { zh: '示例参数', en: 'Example' } }
  ],
  async run(input, params, { onProgress } = {}) {
    // input.boundary: working area in EPSG:27700 metres
    // input.context.parentRoads: roads from the level above, to connect to
    onProgress?.(1);
    return createBundle({
      id: `${mod.level}:${input.id}`,
      level: mod.level,
      parentId: input.id,
      boundary: input.boundary,
      roads: [],
      scenario: { ...params },
      algorithm: { module: mod.id, id: 'my-algorithm', version: mod.version }
    });
  }
};

export default mod;
