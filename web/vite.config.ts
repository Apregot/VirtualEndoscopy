import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteSvgr from "vite-plugin-svgr";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), viteSvgr()],
  build : {
    outDir: '../builtServer/dist'
  },
  define: {
    __VERSION__: JSON.stringify(require("./package.json").version),
  },
})
