export function authError(code: string, message: string, status: number = 400) {
  return Response.json({ error: { code, message } }, { status });
}
