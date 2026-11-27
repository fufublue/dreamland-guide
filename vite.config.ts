
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import { execFileSync } from "node:child_process";

const packageJson = JSON.parse(
  readFileSync('./package.json', 'utf-8')
)

// 取得 dataVersions.ts 最後一次修改的日期
const dataVersionDate = execFileSync(
  'git',
  ['log', '-1', '--format=%cs', '--', 'src/data/dataVersions.ts'],
  { encoding: 'utf-8' }
).trim()

export default defineConfig({
  base: "/dreamland-guide/",
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __DATA_VERSION_DATE__: JSON.stringify(dataVersionDate),
  },
});
