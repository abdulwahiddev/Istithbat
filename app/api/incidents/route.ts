import { NextResponse } from 'next/server';
import { listIncidents } from '@/lib/analysis/read-incidents';

export const runtime='nodejs';
export async function GET() { return NextResponse.json(await listIncidents()); }
