import { NextResponse } from 'next/server';
import { getGatewayInventory } from '@/lib/gateway/read';

export const runtime='nodejs';
export async function GET() { return NextResponse.json(await getGatewayInventory()); }
