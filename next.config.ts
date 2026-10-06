import type { NextConfig } from 'next';

const config:NextConfig={
  outputFileTracingIncludes:{'/*':['./lib/ai/replay/records/**/*','./demo/**/*']},
};

export default config;
