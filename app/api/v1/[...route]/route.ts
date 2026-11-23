import { NextRequest, NextResponse } from 'next/server';
import { handleMockRequest, generateMockBlob } from '@/lib/mock-service';

async function processRequest(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/v1/, '') || '/';
  const query = url.search;
  const fullPath = `${path}${query}`;

  const method = req.method;
  let body: any = null;
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    try {
      body = await req.text();
    } catch {
      body = null;
    }
  }

  // File downloads
  if (path.includes('.pdf') || path.includes('/pdf') || path.includes('payslip') || path.includes('.csv')) {
    const blob = generateMockBlob(path);
    const isPdf = path.includes('.pdf') || path.includes('payslip');
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': isPdf ? 'application/pdf' : 'text/csv',
        'Cache-Control': 'no-store'
      }
    });
  }

  const res = handleMockRequest(fullPath, { method, body });
  return NextResponse.json(res.data, {
    status: res.status,
    headers: {
      'Cache-Control': 'no-store'
    }
  });
}

export async function GET(req: NextRequest) {
  return processRequest(req);
}

export async function POST(req: NextRequest) {
  return processRequest(req);
}

export async function PUT(req: NextRequest) {
  return processRequest(req);
}

export async function PATCH(req: NextRequest) {
  return processRequest(req);
}

export async function DELETE(req: NextRequest) {
  return processRequest(req);
}
