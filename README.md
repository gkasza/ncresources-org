# NC Resources

A free, mobile-first directory of community help — food banks, shelters, diaper banks, rent and utility assistance, transportation, and more — across North Carolina.

**Live site:** [ncresources.org](https://ncresources.org) (once deployed)

## What's in this repo

A pure static site — vanilla HTML, CSS, JavaScript. No framework, no build step, no backend. Loads instantly on a phone.

```
.
├── index.html              the main directory page
├── about.html              about + disclaimer
├── styles.css              NC state flag-inspired theme
├── app.js                  filter logic + result rendering
├── data.json               the resource directory (~2,500 rows)
├── favicon.svg             star icon
├── manifest.webmanifest    PWA manifest
└── vercel.json             headers + caching config
```

## Local development

Just open `index.html` directly, or serve it with any static file server:

```bash
# Python 3
python -m http.server 8000

# Or with Node
npx serve .
```

Then open `http://localhost:8000` (or whatever port the server prints).

## Refreshing the data

The `data.json` file is generated from the upstream NC Resources spreadsheet by the `export_to_json.py` script in the data project (`Diana CWS NC Resources/scripts/`). To refresh:

1. Re-run the data pipeline against [nc211.org](https://nc211.org) (see the data project README)
2. Re-run `python scripts/export_to_json.py` to regenerate `data.json`
3. Commit + push; Vercel auto-deploys

## Design notes

- **NC flag palette:** blue `#002868`, red `#CE1126`, gold `#F5B335`, cream `#FAF6E8`
- **Mobile-first:** designed for a borrowed phone on a slow connection. Filters are top-of-page, results are full-width cards, calls and directions are one tap away.
- **No tracking:** no analytics, no cookies, no third-party scripts. Even the data file lives on the same origin.
- **Print-friendly:** the print stylesheet hides the chrome so a social worker can print a filtered list.

## License

Public service. Use freely.
