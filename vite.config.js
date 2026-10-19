import {defineConfig} from 'vite';
export default defineConfig({base:'./',build:{target:'es2022',rollupOptions:{input:{main:'index.html'},onwarn(warning,warn){if(warning.code!=='MODULE_LEVEL_DIRECTIVE')warn(warning)}},outDir:'dist',chunkSizeWarningLimit:2500},server:{host:'127.0.0.1',port:5174,strictPort:true}});
