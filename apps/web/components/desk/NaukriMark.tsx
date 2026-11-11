export function NaukriMark() {
  return <img src="/brand/naukri.png" alt="Naukri" className="naukri-mark" />;
}

export function LinkedInMark() {
  return <img src="/brand/linkedin.png" alt="LinkedIn" className="naukri-mark linkedin-mark" />;
}

export function GoogleMark() {
  return <img src="/brand/google.png" alt="Google" className="naukri-mark google-mark" />;
}

export function JobSourceMark({ body }: { body: string }) {
  if (
    /careers\.google\.com|jobs\.google\.com|google\.com\/about\/careers|google\.com\/search\?[^)\s]*ibp=htl;jobs/i.test(
      body,
    )
  ) {
    return <GoogleMark />;
  }
  if (/linkedin\.com/i.test(body)) return <LinkedInMark />;
  return <NaukriMark />;
}
