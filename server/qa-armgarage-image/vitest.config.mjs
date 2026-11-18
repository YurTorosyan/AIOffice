export default {root:'/work',cacheDir:'/tmp/vite',server:{fs:{allow:['/work','/opt/qa']}},test:{maxWorkers:1,watch:false,fsModuleCache:false,projects:[
 {root:'/work',test:{name:'react-dom',environment:'jsdom',globals:true,setupFiles:['/work/test-support/setup.ts'],include:['tests/**/*.test.tsx'],fsModuleCache:false}},
 {root:'/work',test:{name:'node-contracts',environment:'node',globals:true,include:['tests/**/*.test.{ts,js,mjs}'],fsModuleCache:false}},
 {root:'/work',test:{name:'trusted-armgarage',environment:'node',globals:true,include:['/opt/qa/armgarage-domain.test.mjs'],fsModuleCache:false}},
]}};
