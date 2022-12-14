import datadome from "./lib/datadome";

export const config = {
  // It's possible to run Datadome for all paths, but it's better to take
  // advantage of pattern matching and only protect from bots where required.
  matcher: ["/"]
};

export default async function middleware(req) {
  const { pathname } = req.nextUrl;

  // `datadome(req)` returns a promise that resolves to
  // a respones (NextResponse) or undefined
  //
  // If there's a response, we made a Datadome request.
  //
  // If the response has a rewrite, it means the request
  // was blocked and we should return it, this would
  // rewrite to the captcha page of Datadome
  //
  // If there's no rewrite, you're not a bot and we
  // send the response that includes Datadome's headers.
  return datadome(req);
}
