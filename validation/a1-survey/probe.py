"""Probe each surveyed restaurant's website for its menu source (A1, US-23).

Usage: python3 validation/a1-survey/probe.py sites.tsv > probe-results.tsv
sites.tsv has: id <TAB> website. Output columns: id, guess, url, evidence.
The guess is checked by hand before it goes into survey.csv.
"""
import re
import sys
import urllib.parse
import urllib.request

UA = "Mozilla/5.0 (WhatsGoodSurvey; UVA student project)"
ORDERING = re.compile(r"(toasttab\.com|square\.site|squareup\.com|chownow\.com|clover\.com/online-ordering|order\.online|menufy\.com|olo\.com|spoton\.com|popmenu)", re.I)
PRICE = re.compile(r"\$\s?\d{1,3}(\.\d{2})?|\b\d{1,3}\.\d{2}\b")


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        ctype = r.headers.get("content-type", "")
        return r.geturl(), ctype, r.read(3_000_000)


def text_of(html):
    html = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", html)
    return re.sub(r"\s+", " ", re.sub(r"(?s)<[^>]+>", " ", html))


def links(base, html):
    for href in re.findall(r'href=["\']([^"\']+)["\']', html, re.I):
        yield urllib.parse.urljoin(base, href)


def classify(site):
    final, ctype, body = get(site)
    html = body.decode("utf-8", "replace")
    found = list(dict.fromkeys(links(final, html)))
    pdfs = [u for u in found if u.lower().split("?")[0].endswith(".pdf") and "menu" in u.lower()]
    ordering = [u for u in found if ORDERING.search(u)]
    menu_pages = [u for u in found if re.search(r"menu", u, re.I) and urllib.parse.urlparse(u).netloc == urllib.parse.urlparse(final).netloc and not u.lower().endswith(".pdf")]

    candidates = [(final, html)]
    for u in menu_pages[:4]:
        try:
            f, c, b = get(u)
            if "pdf" in c:
                pdfs.append(f)
                continue
            h = b.decode("utf-8", "replace")
            candidates.append((f, h))
            sub = list(links(f, h))
            pdfs += [x for x in sub if x.lower().split("?")[0].endswith(".pdf")]
            ordering += [x for x in sub if ORDERING.search(x)]
        except Exception as e:  # noqa: BLE001
            print(f"# {u}: {e}", file=sys.stderr)

    best = max(candidates, key=lambda c: len(PRICE.findall(text_of(c[1]))))
    prices = len(PRICE.findall(text_of(best[1])))
    if prices >= 8:
        return "html", best[0], f"{prices} prices in page text"
    if pdfs:
        return "pdf", pdfs[0], f"{len(set(pdfs))} pdf link(s)"
    if ordering:
        return "ordering-page", ordering[0], "online ordering link"
    imgs = len(re.findall(r"<img", best[1], re.I))
    return "unclear", best[0], f"{prices} prices, {imgs} images on best menu page"


if __name__ == "__main__":
    print("id\tguess\turl\tevidence")
    for line in open(sys.argv[1]):
        rid, site = line.rstrip("\n").split("\t")
        try:
            guess, url, ev = classify(site)
        except Exception as e:  # noqa: BLE001
            guess, url, ev = "error", site, str(e)[:80]
        print(f"{rid}\t{guess}\t{url}\t{ev}", flush=True)
