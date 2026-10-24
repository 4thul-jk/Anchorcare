export async function memoryApi(key: string, path: string, payload?: unknown, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(60000);
  const response = await fetch(`/api/engram${path}`, {
    method: payload === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'X-AnchorCare-Key': key },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error === 'All requested memory sections unavailable' ? 'Saved memories are temporarily unreachable. Check the Atlas network access list and database connection, then retry. Your access key may still be valid.' : data.error || 'Memory service unavailable'), { status: response.status });
  return data;
}
