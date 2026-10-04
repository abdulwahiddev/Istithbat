import { NextResponse } from 'next/server';
import { listSources } from '@/lib/server/source-read';

export const runtime = 'nodejs';
export async function GET() { return NextResponse.json(await listSources()); }
