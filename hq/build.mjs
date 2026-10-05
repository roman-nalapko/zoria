/* збірка показу: src -> dist, все в одному index.html */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, 'src')
const OUT = join(HERE, 'dist')

const html = readFileSync(join(SRC, 'index.html'), 'utf8')

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'index.html'), html)
process.stdout.write(
  'показ зібрано: ' +
    join(OUT, 'index.html') +
    ', ' +
    Math.round(html.length / 1024) +
    ' КіБ\n',
)
