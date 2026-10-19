import {defineConfig} from 'vitest/config';
export default defineConfig({test:{environment:'jsdom',setupFiles:['./tests/setup.js'],include:['tests/**/*.test.jsx'],testTimeout:10000},esbuild:{jsx:'automatic'}});
