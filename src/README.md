# Source layout

`subviz.js` is still the deployable Surge single-file script. The maintainable source now lives under `src/` and is bundled by `tools/build-subviz.js`.

## Files

- `server/00-bootstrap.js`: version, HTTP response helpers, base64 helpers.
- `server/10-country.js`: country/flag/CDN detection rules.
- `server/20-parser.js`: Clash, URI and Surge proxy parsers plus subscription analysis.
- `server/30-fetch-geo.js`: remote subscription fetch, sample data and GeoIP fallback.
- `server/40-surge-policy.js`: Surge `policy-descriptor` builder for landing/availability checks.
- `server/50-landing-availability.js`: landing detection and availability check APIs.
- `server/60-gist.js`: GitHub Gist upload and Surge persistent token APIs.
- `server/90-html-router.js`: HTML shell and request router.
- `client/app.js`: browser-side UI logic served as `/app.js`.

## Commands

```bash
npm run build   # regenerate subviz.js
npm run check   # rebuild and run syntax checks
npm test        # rebuild and run smoke + fixture + client export + Gist regression tests
```

After editing any source file, run `npm run build` and commit both the source change and the regenerated `subviz.js`.

## Clash YAML parser limitations

The built-in YAML parser (`20-parser.js`) handles a **practical subset** of YAML used by Clash configs:

- ✅ Block-style mappings with indentation (`key: value`)
- ✅ Flow-style inline objects (`{ name: foo, type: ss, ... }`)
- ✅ Nested objects via indentation (`ws-opts:`, `reality-opts:`, `grpc-opts:`)
- ✅ Flow-style arrays (`alpn: [h3, h2]`)
- ❌ Multi-line scalars (`|`, `>` block scalars)
- ❌ YAML anchors and aliases (`&anchor`, `*alias`)
- ❌ Quoted keys (`"name":`) — only unquoted keys are matched
- ❌ Merge keys (`<<: *defaults`)
- ❌ Complex flow nesting beyond one level

If a proxy entry cannot be parsed, it is silently skipped. Unrecognized fields are preserved in `extra` for downstream consumption.

## QA fixtures

Regression samples live under `test/fixtures/`. Update `test/fixtures/manifest.json` when adding a new sample so `tools/fixture-test.js` can validate expected node counts, protocols and preserved nested fields. Gist API behavior is covered by `tools/gist-test.js` with mocked GitHub responses and mocked Surge `$persistentStore`.
