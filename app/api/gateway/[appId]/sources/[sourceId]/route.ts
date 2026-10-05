import { NextResponse } from 'next/server';
import { getGatewayState } from '@/lib/gateway/read';
export const runtime='nodejs';
export async function GET(_request:Request,context:{params:Promise<{appId:string;sourceId:string}>}) {
  const {appId,sourceId}=await context.params;
  const state=await getGatewayState(appId,sourceId);
  return state?NextResponse.json(state):NextResponse.json({error:{code:'NOT_FOUND',message:'Gateway binding not found'}},{status:404});
}
