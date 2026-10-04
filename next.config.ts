import type { NextConfig } from 'next';

const config:NextConfig={
  outputFileTracingIncludes:{'/*':['./lib/ai/replay/records/**/*']},
};

export default config;
