export default {root:'/work',cacheDir:'/tmp/vite',test:{maxWorkers:1,watch:false,fsModuleCache:false,projects:[
 {root:'/work',test:{name:'react-dom',environment:'jsdom',globals:true,setupFiles:['/work/test-support/setup.ts'],include:['tests/**/*.test.tsx'],fsModuleCache:false}},
 {root:'/work',test:{name:'node-contracts',environment:'node',globals:true,include:['tests/**/*.test.{ts,js,mjs}'],fsModuleCache:false}},
]}};
