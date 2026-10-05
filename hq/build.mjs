/* збірка показу: src -> dist, все в одному index.html

   Чому в один файл, а не каталогом з файлами поряд. Показ відкривають у
   рамці з ОПАКОВИМ джерелом (контракт штабу, 1.2 і 6.2). В опаковому
   джерелі ключове слово CSP 'self' не збігається ні з чим, і жоден
   зовнішній файл - ні скрипт, ні стиль, ні шрифт - не завантажиться:
   браузер мовчки їх не візьме. Тому код, стилі, шрифти і картинки
   зобов'язані лежати всередині index.html - інлайном або data-URL.

   Збирача тут немає навмисно: заготовка склеює свої модулі сама, і по
   цих сорока рядках видно, чого від збирача треба. Ставите vite,
   esbuild чи свій - міняйте цю команду і поле zaria.hq у package.json;
   умова одна: після `npm ci` і `npm run build` у каталозі лежить
   index.html, який відкривається без жодного запиту в мережу. */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, 'src');
const OUT = join(HERE, 'dist');

/* Порядок склейки - від залежностей до залежних. Мінімальний збирач
   розуміє рівно дві форми: `import { a, b } from './файл.js'` і
   `export` перед оголошенням. Більшого заготовці не треба. */
const seen = new Set();
const chunks = [];

function bundle(file) {
  const path = resolve(SRC, file);
  if (seen.has(path)) return;
  seen.add(path);
  const text = readFileSync(path, 'utf8');
  for (const m of text.matchAll(/^import\s+[^']*from\s+'(\.[^']+)';?$/gm)) {
    bundle(resolve(dirname(path), m[1]));
  }
  chunks.push(
    text
      .replace(/^import\s+[^']*from\s+'[^']+';?$/gm, '')
      .replace(/^export\s+default\s+\w+;?$/gm, '')
      .replace(/^export\s+\{[^}]*\};?$/gm, '')
      .replace(/^export\s+/gm, ''),
  );
}

bundle('hq.js');

const css = readFileSync(join(SRC, 'style.css'), 'utf8');
const html = readFileSync(join(SRC, 'index.html'), 'utf8')
  .replace(/\s*<link rel="stylesheet"[^>]*>/, '\n    <style>\n' + css + '\n    </style>')
  .replace(
    /\s*<script type="module" src="[^"]*"><\/script>/,
    '\n    <script type="module">\n' + chunks.join('\n') + '\n    </script>',
  );

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'index.html'), html);
process.stdout.write('показ зібрано: ' + join(OUT, 'index.html') + ', ' + Math.round(html.length / 1024) + ' КіБ\n');
