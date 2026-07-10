// GraphRay 构建前配置注入
// 作用：把本地不入库的 config.local.json 合并覆盖为 assets/resources/configs/runtime.json（进构建包，但 gitignore）。
// 若 config.local.json 不存在，回退到 config.example.json，保证空仓库也能构建出可用包。
// 用法：在 cocos build 之前执行 `node tools/inject-config.js`
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const local = path.join(root, 'config.local.json');
const example = path.join(root, 'config.example.json');
const out = path.join(root, 'assets', 'resources', 'configs', 'runtime.json');

function load(p) {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error('[inject-config] 解析失败:', p, e.message);
    process.exit(1);
  }
}

const src = load(local) || load(example);
if (!src) {
  console.error('[inject-config] 找不到 config.local.json 或 config.example.json，已中止。');
  process.exit(1);
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(src, null, 2));
const s = src.server || {};
console.log('[inject-config] 已生成运行时配置 ->',
  path.relative(root, out),
  `(server: ${s.host}:${s.port}, env: ${src.env})`);
