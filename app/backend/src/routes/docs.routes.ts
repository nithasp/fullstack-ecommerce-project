import { Request, Response, Router } from 'express';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';

const SPEC_PATH = path.join(__dirname, '..', '..', 'openapi.yaml');

let specCache: string | null = null;

const readSpec = (): string => {
  if (specCache === null) specCache = fs.readFileSync(SPEC_PATH, 'utf8');
  return specCache;
};

const SWAGGER_UI_CDN = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5';

// helmet's default policy is `script-src 'self'`, which would block the CDN bundle, so the
// docs page gets its own policy instead of loosening it for the whole API
const docsCsp = helmet.contentSecurityPolicy({
  useDefaults: false,
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
    styleSrc: ["'self'", 'https://cdn.jsdelivr.net', "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
    fontSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'self'"],
    baseUri: ["'self'"],
  },
});

const DOCS_PAGE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Storefront API — Reference</title>
    <link rel="stylesheet" href="${SWAGGER_UI_CDN}/swagger-ui.css" />
    <link rel="stylesheet" href="/docs/theme.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${SWAGGER_UI_CDN}/swagger-ui-bundle.js" crossorigin></script>
    <script src="/docs/init.js"></script>
  </body>
</html>
`;

// Kept out of the HTML so the page needs no 'unsafe-inline' in script-src
const DOCS_INIT = `window.ui = SwaggerUIBundle({
  url: '/openapi.yaml',
  dom_id: '#swagger-ui',
  deepLinking: true,
  persistAuthorization: true,
  displayRequestDuration: true,
  docExpansion: 'none',
  filter: true,
  tryItOutEnabled: true,
  presets: [SwaggerUIBundle.presets.apis],
  layout: 'BaseLayout',
});
`;

const DOCS_THEME = `:root {
  --doc-ink: #1c2333;
  --doc-ink-soft: #46506a;
  --doc-ink-faint: #6b7587;
  --doc-line: #e3e7ee;
  --doc-surface: #ffffff;
  --doc-canvas: #f6f7f9;
  --doc-accent: #2b6cb0;
  --doc-code-bg: #eef1f6;
  --doc-pre-bg: #1f2632;
  --doc-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --doc-mono: ui-monospace, SFMono-Regular, "Cascadia Mono", Consolas, "Liberation Mono", monospace;
}

body { margin: 0; background: var(--doc-canvas); }

.swagger-ui { color: var(--doc-ink); -webkit-font-smoothing: antialiased; }

.swagger-ui,
.swagger-ui h1, .swagger-ui h2, .swagger-ui h3, .swagger-ui h4, .swagger-ui h5,
.swagger-ui p, .swagger-ui li, .swagger-ui small, .swagger-ui a,
.swagger-ui table, .swagger-ui td, .swagger-ui th, .swagger-ui label,
.swagger-ui button, .swagger-ui input, .swagger-ui select, .swagger-ui textarea,
.swagger-ui .info .title,
.swagger-ui .opblock-tag,
.swagger-ui .opblock .opblock-summary-method,
.swagger-ui .opblock .opblock-summary-description,
.swagger-ui .parameter__in,
.swagger-ui .response-col_description,
.swagger-ui .scheme-container .schemes-title { font-family: var(--doc-sans) !important; }

.swagger-ui code,
.swagger-ui pre,
.swagger-ui .microlight,
.swagger-ui .microlight *,
.swagger-ui .opblock .opblock-summary-path,
.swagger-ui .opblock .opblock-summary-path *,
.swagger-ui .parameter__name,
.swagger-ui .parameter__type,
.swagger-ui .prop-type,
.swagger-ui .prop-format,
.swagger-ui .model,
.swagger-ui .model * { font-family: var(--doc-mono) !important; }

.swagger-ui .wrapper { max-width: 1180px; }

.swagger-ui .info { margin: 44px 0 30px; }
.swagger-ui .info hgroup.main { margin-bottom: 18px; }
.swagger-ui .info .title {
  font-size: 34px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--doc-ink);
}
.swagger-ui .info .description { max-width: max-content; }
.swagger-ui .info .description p,
.swagger-ui .info .description li {
  font-size: 15px;
  line-height: 1.7;
  color: var(--doc-ink-soft);
}
.swagger-ui .info .description h2 {
  font-size: 20px;
  font-weight: 650;
  color: var(--doc-ink);
  margin: 36px 0 12px;
  padding-bottom: 7px;
  border-bottom: 1px solid var(--doc-line);
}
.swagger-ui .info .description h3 {
  font-size: 16px;
  font-weight: 650;
  color: var(--doc-ink);
  margin: 24px 0 8px;
}
.swagger-ui .info .description ul { padding-left: 22px; margin: 10px 0; }
.swagger-ui .info .description li { margin: 7px 0; }
.swagger-ui .info .description li > p { margin: 0; }

.swagger-ui .renderedMarkdown code,
.swagger-ui .markdown code {
  background: var(--doc-code-bg);
  border: 0;
  border-radius: 4px;
  color: #26303f;
  padding: 0.12em 0.4em;
  font-size: 0.89em;
}
.swagger-ui .renderedMarkdown pre,
.swagger-ui .markdown pre {
  background: var(--doc-pre-bg);
  color: #e8ecf4;
  border-radius: 8px;
  padding: 14px 16px;
  margin: 14px 0;
  font-size: 13px;
  line-height: 1.6;
  overflow-x: auto;
}
.swagger-ui .renderedMarkdown pre code,
.swagger-ui .markdown pre code {
  background: none;
  border: 0;
  color: inherit;
  padding: 0;
  font-size: inherit;
}

.swagger-ui .scheme-container {
  background: var(--doc-surface);
  box-shadow: none;
  border-top: 1px solid var(--doc-line);
  border-bottom: 1px solid var(--doc-line);
  padding: 18px 0;
  margin: 0 0 30px;
}
.swagger-ui .scheme-container .schemes-title {
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--doc-ink-faint);
}

.swagger-ui .filter .operation-filter-input {
  border: 1px solid #d3d9e3;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 14px;
}

.swagger-ui .opblock-tag {
  font-size: 21px;
  font-weight: 650;
  color: var(--doc-ink);
  padding: 16px 20px 14px;
  margin: 34px 0 10px;
  border-bottom: 1px solid var(--doc-line);
}
.swagger-ui .opblock-tag small,
.swagger-ui .opblock-tag small p {
  font-size: 13.5px;
  font-weight: 400;
  line-height: 1.55;
  color: var(--doc-ink-faint);
  margin: 0;
}
.swagger-ui .opblock-tag small { padding-left: 14px; }

.swagger-ui .opblock {
  border-radius: 10px;
  margin: 0 0 10px;
  box-shadow: 0 1px 2px rgba(18, 26, 42, 0.06);
}
.swagger-ui .opblock .opblock-summary { padding: 8px 14px; align-items: center; }
.swagger-ui .opblock .opblock-summary-method {
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  min-width: 84px;
  padding: 7px 0;
  border-radius: 6px;
  text-shadow: none;
}
.swagger-ui .opblock .opblock-summary-path {
  font-size: 14.5px;
  font-weight: 600;
  color: var(--doc-ink);
}
.swagger-ui .opblock .opblock-summary-description {
  font-size: 13.5px;
  color: var(--doc-ink-faint);
}

.swagger-ui .opblock-description-wrapper p,
.swagger-ui .opblock-description-wrapper li {
  font-size: 14px;
  line-height: 1.65;
  color: var(--doc-ink-soft);
}
.swagger-ui .opblock-section-header h4 {
  font-size: 12.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--doc-ink-faint);
}

.swagger-ui table thead tr th,
.swagger-ui table thead tr td {
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--doc-ink-faint);
  border-bottom: 2px solid var(--doc-line);
  padding: 10px;
}
.swagger-ui table tbody tr td {
  padding: 12px 10px;
  vertical-align: top;
  border-bottom: 1px solid #f0f2f6;
}
.swagger-ui .parameter__name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--doc-ink);
}
.swagger-ui .parameter__type { font-size: 12px; color: var(--doc-ink-faint); }
.swagger-ui .parameter__in { font-size: 11.5px; font-style: normal; color: #8a93a5; }
.swagger-ui .response-col_status { font-size: 14px; font-weight: 700; color: var(--doc-ink); }
.swagger-ui .response-col_description,
.swagger-ui .response-col_description p {
  font-size: 14px;
  line-height: 1.6;
  color: var(--doc-ink-soft);
}

.swagger-ui .model { font-size: 13px; line-height: 1.65; }
.swagger-ui .model-title { font-size: 15px; font-weight: 650; }
.swagger-ui .prop-type { font-size: 12.5px; }
.swagger-ui .microlight { font-size: 12.5px; line-height: 1.6; }

.swagger-ui a, .swagger-ui .info a { color: var(--doc-accent); }
.swagger-ui a:hover { text-decoration: underline; }
.swagger-ui .btn { border-radius: 7px; font-weight: 600; font-size: 13.5px; }

@media (max-width: 640px) {
  .swagger-ui .info .title { font-size: 26px; }
  .swagger-ui .info .description p,
  .swagger-ui .info .description li { font-size: 14.5px; }
  .swagger-ui .opblock .opblock-summary-method { min-width: 68px; font-size: 11.5px; }
  .swagger-ui .opblock .opblock-summary-path { font-size: 13px; word-break: break-all; }
  .swagger-ui .opblock-tag { font-size: 18px; }
  .swagger-ui .opblock-tag small { display: block; padding: 6px 0 0; }
}
`;

const sendSpec = (_req: Request, res: Response): void => {
  try {
    res.type('application/yaml').send(readSpec());
  } catch {
    res.status(500).json({ status: 500, message: 'API specification is unavailable', data: null });
  }
};

const router = Router();

router.get('/openapi.yaml', sendSpec);
router.get('/docs/init.js', (_req: Request, res: Response) => {
  res.type('application/javascript').send(DOCS_INIT);
});
router.get('/docs/theme.css', (_req: Request, res: Response) => {
  res.type('text/css').send(DOCS_THEME);
});
router.get('/docs', docsCsp, (_req: Request, res: Response) => {
  res.type('html').send(DOCS_PAGE);
});

export default router;
