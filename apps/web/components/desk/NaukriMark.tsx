export function NaukriMark() {
  return <img src="/brand/naukri.png" alt="Naukri" className="naukri-mark" />;
}

export function LinkedInMark() {
  return <img src="/brand/linkedin.png" alt="LinkedIn" className="naukri-mark linkedin-mark" />;
}

export function JobSourceMark({ body }: { body: string }) {
  if (/linkedin\.com/i.test(body)) return <LinkedInMark />;
  return <NaukriMark />;
}
