/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const picRoot = path.join(root, 'assets', 'Image', 'Player', 'pic');
const aniRoot = path.join(root, 'assets', 'Image', 'Player', 'ani');

const TARGET_PLAYERS = ['player1', 'player2', 'player3', 'player4', 'player5', 'player6', 'player7'];
const DIRS = ['right', 'left', 'up', 'down'];

const TEMPLATE = {
  __type__: 'cc.AnimationClip',
  _name: 'animation',
  _objFlags: 0,
  __editorExtras__: { embeddedPlayerGroups: [] },
  _native: '',
  sample: 24,
  speed: 1,
  wrapMode: 2,
  enableTrsBlending: false,
  _duration: 0.25,
  _hash: 0,
  _tracks: [{ __id__: 1 }],
  _exoticAnimation: null,
  _events: [],
  _embeddedPlayers: [],
  _additiveSettings: { __id__: 6 },
  _auxiliaryCurveEntries: [],
};

function parseMetaUuid(metaPath) {
  const raw = fs.readFileSync(metaPath, 'utf8');
  const json = JSON.parse(raw);
  if (!json || typeof json.uuid !== 'string') {
    throw new Error(`meta 缺少 uuid: ${metaPath}`);
  }
  return `${json.uuid}@f9941`;
}

function readPlayerFrames(playerDir) {
  const abs = path.join(picRoot, playerDir);
  if (!fs.existsSync(abs)) return [];
  const files = fs.readdirSync(abs).filter((f) => f.endsWith('.png.meta'));
  const frames = files
    .map((f) => {
      const m = f.match(/(\d+)[^\d]*\.png\.meta$/);
      if (!m) return null;
      return {
        index: Number(m[1]),
        uuid: parseMetaUuid(path.join(abs, f)),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index);
  return frames;
}

function buildAnim(name, values) {
  const n = values.length;
  const times = n === 1 ? [0] : [0, 0.125, 0.20833333333333334].slice(0, n);
  const uuidValues = values.map((uuid) => ({ __uuid__: uuid, __expectedType__: 'cc.SpriteFrame' }));
  return [
    { ...TEMPLATE, _name: name },
    {
      __type__: 'cc.animation.ObjectTrack',
      _binding: {
        __type__: 'cc.animation.TrackBinding',
        path: { __id__: 2 },
        proxy: null,
      },
      _channel: { __id__: 4 },
    },
    {
      __type__: 'cc.animation.TrackPath',
      _paths: [{ __id__: 3 }, 'spriteFrame'],
    },
    {
      __type__: 'cc.animation.ComponentPath',
      component: 'cc.Sprite',
    },
    {
      __type__: 'cc.animation.Channel',
      _curve: { __id__: 5 },
    },
    {
      __type__: 'cc.ObjectCurve',
      _times: times,
      _values: uuidValues,
    },
    {
      __type__: 'cc.AnimationClipAdditiveSettings',
      enabled: false,
      refClip: null,
    },
  ];
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function main() {
  ensureDir(aniRoot);
  const errors = [];
  const done = [];

  for (const p of TARGET_PLAYERS) {
    try {
      const frames = readPlayerFrames(p);
      if (frames.length < 12) {
        throw new Error(`${p} 帧数不足（至少 12 张，按排序每 3 张一组：右左上下）`);
      }
      const twelve = frames.slice(0, 12);
      for (let i = 0; i < 4; i += 1) {
        const dir = DIRS[i];
        const g = twelve.slice(i * 3, i * 3 + 3);
        const walkName = `${p}_walk_${dir}`;
        const idleName = `${p}_idle_${dir}`;

        // 走路：第 1 / 3 帧往返（和你模板 A-B-A 一样）
        const walkData = buildAnim(walkName, [g[0].uuid, g[2].uuid, g[0].uuid]);
        const walkPath = path.join(aniRoot, `${walkName}.anim`);
        fs.writeFileSync(walkPath, `${JSON.stringify(walkData, null, 2)}\n`, 'utf8');
        done.push(walkPath);

        // 待机：第 2 帧（中间帧）
        const idleData = buildAnim(idleName, [g[1].uuid]);
        const idlePath = path.join(aniRoot, `${idleName}.anim`);
        fs.writeFileSync(idlePath, `${JSON.stringify(idleData, null, 2)}\n`, 'utf8');
        done.push(idlePath);
      }
    } catch (e) {
      errors.push(String(e.message || e));
    }
  }

  console.log(`生成完成: ${done.length} 个`);
  done.forEach((f) => console.log(`  - ${path.relative(root, f)}`));

  if (errors.length) {
    console.error('\n失败项:');
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exitCode = 1;
  }
}

main();
