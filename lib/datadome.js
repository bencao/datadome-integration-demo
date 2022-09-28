import { NextResponse } from "next/server";

/* based on example at https://github.com/vercel/examples/tree/main/edge-functions/bot-protection-datadome */

const DATADOME_TIMEOUT = 500;
const DATADOME_URI_REGEX_EXCLUSION = /\.(avi|flv|mka|mkv|mov|mp4|mpeg|mpg|mp3|flac|ogg|ogm|opus|wav|webm|webp|bmp|gif|ico|jpeg|jpg|png|svg|svgz|swf|eot|otf|ttf|woff|woff2|css|less|js)$/i;

async function makeRequest({
  ip,
  method,
  host,
  request,
  headerKeys,
  userAgent,
  referer,
  acceptEncoding,
  acceptLanguage,
  acceptCharset,
  origin,
  xForwardedFor,
  connection,
  pragma,
  cacheControl,
  contentType,
  from,
  via,
  cookiesLength,
  authorizationLength,
  contentLength,
  clientId
}) {
  const requestData = {
    Key: process.env.DATADOME_SERVER_KEY,
    RequestModuleName: "Next.js",
    ModuleVersion: "0.1",
    ServerName: "vercel",
    IP: ip,
    Port: 0,
    TimeRequest: new Date().getTime() * 1000,
    Protocol: "https",
    Method: method,
    ServerHostname: host,
    Request: request,
    HeadersList: headerKeys,
    Host: host,
    UserAgent: userAgent,
    Referer: referer,
    // Make sure Datadome always returns a JSON response in case of a 403
    Accept: "application/json",
    AcceptEncoding: acceptEncoding,
    AcceptLanguage: acceptLanguage,
    AcceptCharset: acceptCharset,
    Origin: origin,
    XForwaredForIP: xForwardedFor,
    Connection: connection,
    Pragma: pragma,
    CacheControl: cacheControl,
    ContentType: contentType,
    From: from,
    Via: via,
    CookiesLen: cookiesLength,
    AuthorizationLen: authorizationLength,
    PostParamLen: contentLength,
    ClientID: clientId,
    ServerRegion: "sfo1"
  };

  console.log("datadome makeRequest request", requestData);

  const dataDomeReq = fetch(
    "http://api.datadome.co/validate-request/",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "DataDome"
      },
      body: stringify(requestData)
    }
  );

  const timeoutPromise = new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error("Datadome timeout"));
    }, DATADOME_TIMEOUT);
  });

  let dataDomeRes;

  try {
    dataDomeRes = await Promise.race([dataDomeReq, timeoutPromise]);
    console.log(
      "Datadome debug",
      dataDomeRes.status,
      JSON.stringify(Object.fromEntries(dataDomeRes.headers.entries()), null, 2)
    );

    if (dataDomeRes.status === 400) {
      console.log("DataDome returned 400", dataDomeRes.statusText);
    }

    const isBot = dataDomeRes.headers.get("x-datadome-isbot");

    if (isBot) {
      console.log(
        "Bot detected. Name:",
        dataDomeRes.headers.get("x-datadome-botname"),
        "– Kind:",
        dataDomeRes.headers.get("x-datadome-botfamily")
      );
    }

    let redirectUrl = {};

    if (dataDomeRes.status !== 200) {
      try {
        const data = await dataDomeRes.json();
        redirectUrl = data.url;
      } catch (jsonErr) {
        console.log("error parse data dome response", jsonErr);
      }
    }

    const headers = {};
    const list = dataDomeRes.headers.get("x-datadome-headers");
    for (const header of list.split(" ")) {
      const value = dataDomeRes.headers.get(header);
      // workaround for a bug in DataDome where the cookie domain gets set to
      // the entire public suffix (.vercel.app), which UAs refuse to set cookies for
      // e.g.: https://devcenter.heroku.com/articles/cookies-and-herokuapp-com
      if (
        header.toLowerCase() === "set-cookie" &&
        /domain=\.vercel\.app/i.test(value)
      ) {
        headers[header] = value.replace(
          /domain=\.vercel\.app/i,
          `Domain=${host}`
        );
      } else {
        headers[header] = value;
      }
    }

    const result = {
      status: dataDomeRes.status,
      isBot,
      headers,
      redirectUrl
    };

    console.log("datadome makeRequest result", result);

    return result;
  } catch (err) {
    if (err.message === "Datadome timeout") {
      console.error("Datadome timeout:", err.stack);

      return { status: 408, headers: {}, isBot: false, redirectUrl: null };
    }

    console.error("Datadome failed with:", err.stack);

    return { status: 500, headers: {}, isBot: false, redirectUrl: null };
  }
}

export function withDatadome(handler) {
  return async function datadomeHandler(req, res) {
    const isLocal = !!req.headers["x-real-ip"];

    if (!isLocal && !DATADOME_URI_REGEX_EXCLUSION.test(req.url)) {
      const { isBot, redirectUrl } = await makeRequest({
        ip: req.headers["x-real-ip"] ? req.headers["x-real-ip"] : "127.0.0.1",
        method: req.method,
        host: req.headers["host"],
        request: req.url + encode(req.query),
        headerKeys: Object.keys(req.headers).join(","),
        userAgent: req.headers["user-agent"],
        referer: req.headers["referer"],
        acceptEncoding: req.headers["accept-encoding"],
        acceptLanguage: req.headers["accept-language"],
        acceptCharset: req.headers["accept-charset"],
        origin: req.headers["origin"],
        xForwardedFor: req.headers["x-forwarded-for"],
        connection: req.headers["connection"],
        pragma: req.headers["pragma"],
        cacheControl: req.headers["cache-control"],
        contentType: req.headers["content-type"],
        from: req.headers["from"],
        via: req.headers["via"],
        cookiesLength: getCookiesLength(Object.values(req.cookies)),
        authorizationLength: getAuthorizationLength(
          req.headers["authorization"]
        ),
        contentLength: req.headers["content-length"],
        clientId: req.cookies["datadome"]
      });

      if (isBot) {
        if (redirectUrl) {
          res.redirect(redirectUrl);
        } else {
          res.status(429).end("too many requests");
        }

        return;
      }
    }

    const value = await handler(req, res);

    return value;
  };
}

export default async function datadome(req) {
  const { pathname } = req.nextUrl;

  if (DATADOME_URI_REGEX_EXCLUSION.test(pathname)) {
    return;
  }

  // this should be `x-real-ip` but it doesn't currently work on Edge Functions
  const ip = req.headers.get("x-forwarded-for")
    ? req.headers.get("x-forwarded-for").split(",")[0]
    : "127.0.0.1";

  if (ip === "127.0.0.1") {
    // skip local
    return;
  }

  const dataDomeStart = Date.now();

  const { status, isBot, headers, redirectUrl } = await makeRequest({
    ip,
    method: req.method,
    host: req.headers.get("host"),
    request: pathname + encode(Object.fromEntries(req.nextUrl.searchParams)),
    headerKeys: [...req.headers.keys()].join(","),
    userAgent: req.headers.get("user-agent"),
    referer: req.headers.get("referer"),
    acceptEncoding: req.headers.get("accept-encoding"),
    acceptLanguage: req.headers.get("accept-language"),
    acceptCharset: req.headers.get("accept-charset"),
    origin: req.headers.get("origin"),
    xForwardedFor: req.headers.get("x-forwarded-for"),
    connection: req.headers.get("connection"),
    pragma: req.headers.get("pragma"),
    cacheControl: req.headers.get("cache-control"),
    contentType: req.headers.get("content-type"),
    from: req.headers.get("from"),
    via: req.headers.get("via"),
    cookiesLength: getCookiesLength(req.cookies.values()),
    authorizationLength: getAuthorizationLength(
      req.headers.get("authorization")
    ),
    contentLength: req.headers.get("content-length"),
    clientId: req.cookies.get("datadome")
  });

  if (status === 400) {
    // Something is wrong with our authentication
    return;
  }

  // next() returns a null body and we'll use it to indicate
  // that the request is not blocked
  let res = NextResponse.next();

  if (isBot && redirectUrl) {
    res = NextResponse.rewrite(redirectUrl);
  }

  // Add Datadome headers to the response
  if (Object.keys(headers).length > 0) {
    Object.keys(headers).forEach(k => {
      res.headers.set(k, headers[k]);
    });
  }

  // We're sending the latency for demo purposes, this is not something you need to do
  res.headers.set("x-datadome-latency", `${Date.now() - dataDomeStart}`);

  return res;
}

function encode(query) {
  let e = "";
  for (const k in query) {
    const v = query[k];
    e += `${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
  }
  return e;
}

// taken from DataDome-Cloudflare-1.7.0
function getAuthorizationLength(authorization) {
  return authorization ? authorization.length : null;
}

// taken from DataDome-Cloudflare-1.7.0
function stringify(obj) {
  return obj
    ? Object.keys(obj)
        .map(key => {
          const value = obj[key];
          if (value === undefined) {
            return "";
          }
          return value === null || value === undefined
            ? encodeURIComponent(key)
            : encodeURIComponent(key) + "=" + encodeURIComponent(value);
        })
        .filter(x => x.length > 0)
        .join("&")
    : "";
}

function getCookiesLength(cookieValues) {
  let cookiesLength = 0;
  for (const value of cookieValues) {
    cookiesLength += value.length;
  }
  return cookiesLength;
}
